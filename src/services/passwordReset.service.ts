import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import bcrypt from 'bcrypt';
import { Op, QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { env } from '../config/env';
import { User } from '../models/User.model';
import { AppError } from '../utils/AppError';
import { emailService } from './email.service';

export const RESET_MESSAGE = 'Nếu tài khoản tồn tại, mã OTP đã được gửi tới email đăng ký';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const otpDigest = (id: string, code: string) =>
  createHmac('sha256', env.APP_SECRET_KEY).update(`${id}:${code}`).digest('hex');
interface ResetRow {
  id: string;
  user_id: number;
  otp_code: string;
  expires_at: Date;
  is_used: boolean;
  attempts: number;
  reset_token_hash: string | null;
}

// A DB row lock makes the rolling limit effective across processes and concurrent requests.
async function consume(key: string, max: number, cooldown: number, transaction: Transaction) {
  const hashed = digest(key);
  // UPSERT takes an exclusive lock immediately; INSERT IGNORE followed by a
  // lock upgrade can deadlock when several requests create the same bucket.
  await sequelize.query(
    "INSERT INTO password_reset_limits (`key`,hits,updated_at) VALUES (:key,'[]',NOW()) ON DUPLICATE KEY UPDATE `key`=VALUES(`key`)",
    { replacements: { key: hashed }, transaction },
  );
  const [row] = await sequelize.query<{ hits: string }>(
    'SELECT hits FROM password_reset_limits WHERE `key`=:key FOR UPDATE',
    { replacements: { key: hashed }, type: QueryTypes.SELECT, transaction },
  );
  const now = Date.now();
  const hits: number[] = JSON.parse(row.hits).filter((time: number) => time > now - 3600000);
  if (hits.length >= max || (hits.length && now - hits[hits.length - 1] < cooldown)) return false;
  hits.push(now);
  await sequelize.query(
    'UPDATE password_reset_limits SET hits=:hits,updated_at=NOW() WHERE `key`=:key',
    { replacements: { key: hashed, hits: JSON.stringify(hits) }, transaction },
  );
  return true;
}
const invalid = () =>
  AppError.badRequest('Mã xác thực không hợp lệ hoặc đã hết hạn. Vui lòng bắt đầu lại.');
const usable = (row?: ResetRow) =>
  row && !row.is_used && row.attempts < 5 && new Date(row.expires_at).getTime() > Date.now();

export const passwordResetService = {
  async cleanup() {
    await sequelize.query(
      'DELETE FROM password_reset_otp WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)',
    );
    await sequelize.query(
      'DELETE FROM password_reset_limits WHERE updated_at < DATE_SUB(NOW(), INTERVAL 1 DAY)',
    );
  },
  async request(identifier: string, ip: string) {
    const challenge = randomBytes(32).toString('hex');
    const normalized = identifier.trim().toLowerCase();
    let delivery: { email: string; code: string } | undefined;
    await sequelize.transaction(async (transaction) => {
      if (!(await consume(`ip:${ip}`, 20, 0, transaction))) return;
      // Resolve aliases to the registered email so username/email cannot bypass the limit.
      const candidates = await User.findAll({
        where: { [Op.or]: [{ username: normalized }, { email: normalized }] },
        transaction,
      });
      const user = candidates.length === 1 ? candidates[0] : undefined;
      const email = user?.email.trim().toLowerCase() || normalized;
      if (!(await consume(`email:${email}`, 3, 60000, transaction))) return;
      if (!user || user.status !== 'active') return;
      await User.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE });
      const code = randomInt(0, 1000000).toString().padStart(6, '0');
      await sequelize.query(
        'UPDATE password_reset_otp SET is_used=1,reset_token_hash=NULL WHERE user_id=:user',
        { replacements: { user: user.id }, transaction },
      );
      await sequelize.query(
        'INSERT INTO password_reset_otp (id,user_id,otp_code,expires_at,is_used,attempts,created_at) VALUES (:id,:user,:code,:expires,0,0,NOW())',
        {
          replacements: {
            id: challenge,
            user: user.id,
            code: otpDigest(challenge, code),
            expires: new Date(Date.now() + 300000),
          },
          transaction,
        },
      );
      delivery = { email: user.email, code };
    });
    // SMTP latency/failure must not reveal whether an account exists. Never log the OTP.
    if (delivery) {
      const mail = delivery;
      setImmediate(() => {
        void emailService.sendPasswordReset(mail.email, mail.code).catch(async () => {
          console.error('Password reset email delivery failed');
          await sequelize
            .query('UPDATE password_reset_otp SET is_used=1,reset_token_hash=NULL WHERE id=:id', {
              replacements: { id: challenge },
            })
            .catch(() => undefined);
        });
      });
    }
    return { challenge, expires_in: 300, resend_after: 60, message: RESET_MESSAGE };
  },
  async verify(challenge: string, code: string) {
    const result = await sequelize.transaction(async (transaction) => {
      const [row] = await sequelize.query<ResetRow>(
        'SELECT * FROM password_reset_otp WHERE id=:id FOR UPDATE',
        { replacements: { id: challenge }, type: QueryTypes.SELECT, transaction },
      );
      if (!usable(row) || row.reset_token_hash) return null;
      if (
        !timingSafeEqual(
          Buffer.from(row.otp_code, 'hex'),
          Buffer.from(otpDigest(challenge, code), 'hex'),
        )
      ) {
        const attempts = row.attempts + 1;
        await sequelize.query(
          'UPDATE password_reset_otp SET attempts=:attempts,is_used=:used WHERE id=:id',
          { replacements: { id: challenge, attempts, used: attempts >= 5 }, transaction },
        );
        return { attempts_remaining: 5 - attempts };
      }
      const token = randomBytes(32).toString('hex');
      await sequelize.query('UPDATE password_reset_otp SET reset_token_hash=:token WHERE id=:id', {
        replacements: { id: challenge, token: digest(token) },
        transaction,
      });
      return { reset_token: token, expires_at: row.expires_at };
    });
    // Throw outside transaction so failed attempts are committed.
    if (!result) throw invalid();
    if ('attempts_remaining' in result)
      throw AppError.badRequest(
        result.attempts_remaining === 0
          ? 'Đã nhập sai 5 lần. Vui lòng bắt đầu lại từ bước 1.'
          : `Mã OTP không đúng. Còn ${result.attempts_remaining} lần thử.`,
      );
    return result;
  },
  async reset(challenge: string, token: string, password: string) {
    const [candidate] = await sequelize.query<ResetRow>(
      'SELECT * FROM password_reset_otp WHERE id=:id',
      { replacements: { id: challenge }, type: QueryTypes.SELECT },
    );
    if (!usable(candidate) || candidate.reset_token_hash !== digest(token)) throw invalid();
    const passwordHash = await bcrypt.hash(password, 12);
    await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(candidate.user_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const [row] = await sequelize.query<ResetRow>(
        'SELECT * FROM password_reset_otp WHERE id=:id FOR UPDATE',
        { replacements: { id: challenge }, type: QueryTypes.SELECT, transaction },
      );
      if (
        !user ||
        user.status !== 'active' ||
        !usable(row) ||
        row.reset_token_hash !== digest(token)
      )
        throw invalid();
      await user.update(
        { password_hash: passwordHash, session_version: user.session_version + 1 },
        { transaction },
      );
      await sequelize.query(
        'UPDATE password_reset_otp SET is_used=1,reset_token_hash=NULL WHERE user_id=:user',
        { replacements: { user: user.id }, transaction },
      );
    });
  },
};
