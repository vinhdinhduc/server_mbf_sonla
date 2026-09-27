import { QueryTypes } from 'sequelize';
import bcrypt from 'bcrypt';
import { sequelize } from '../../src/config/database';
import { env } from '../../src/config/env';
import '../../src/models';
import { User } from '../../src/models/User.model';
import { passwordResetService } from '../../src/services/passwordReset.service';
import { emailService } from '../../src/services/email.service';
import { contactService } from '../../src/services/contact.service';
import { newsletterService } from '../../src/services/newsletter.service';
import { NewsletterSubscriber } from '../../src/models/NewsletterSubscriber.model';

jest.mock('../../src/services/email.service', () => ({
  emailService: {
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    enqueue: jest.fn().mockResolvedValue(undefined),
    unsuppress: jest.fn().mockResolvedValue(undefined),
  },
}));
const suite = process.env.LEGAL_DB_TEST === '1' ? describe : describe.skip;
suite('legal consent and OTP on an isolated MySQL database', () => {
  let user: User;
  let serial = 0;
  beforeAll(async () => {
    if (env.DB_NAME !== 'legal_consent_otp' || env.DB_HOST !== '127.0.0.1' || env.DB_PORT !== 3311)
      throw new Error('This test only runs on legal_consent_otp at 127.0.0.1:3311');
    await sequelize.authenticate();
  });
  beforeEach(async () => {
    serial += 1;
    user = await User.create({
      username: `reset-${Date.now()}-${serial}`,
      email: `reset-${Date.now()}-${serial}@example.com`,
      full_name: 'OTP test',
      phone: '0901234567',
      role: 'nhan_vien',
      password_hash: await bcrypt.hash('OldPassword123', 4),
    });
    jest.clearAllMocks();
  });
  afterEach(async () => {
    await user.destroy();
  });
  afterAll(async () => {
    await sequelize.close();
  });
  const mail = async () => {
    await new Promise(setImmediate);
    return (emailService.sendPasswordReset as jest.Mock).mock.calls.at(-1)[1] as string;
  };
  it('serializes concurrent send requests and the fifth incorrect OTP attempt', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        passwordResetService.request(i % 2 ? user.username : user.email, `test-ip-${i}`),
      ),
    );
    const code = await mail();
    expect(emailService.sendPasswordReset).toHaveBeenCalledTimes(1);
    const rows = await sequelize.query<{ id: string; otp_code: string }>(
      'SELECT id,otp_code FROM password_reset_otp WHERE user_id=:user',
      { replacements: { user: user.id }, type: QueryTypes.SELECT },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].otp_code).not.toBe(code);
    expect(attempts.some((item) => item.challenge === rows[0].id)).toBe(true);
    const wrong = code === '000000' ? '000001' : '000000';
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => passwordResetService.verify(rows[0].id, wrong)),
    );
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    await expect(passwordResetService.verify(rows[0].id, code)).rejects.toThrow();
    const [row] = await sequelize.query<{ attempts: number; is_used: number }>(
      'SELECT attempts,is_used FROM password_reset_otp WHERE id=:id',
      { replacements: { id: rows[0].id }, type: QueryTypes.SELECT },
    );
    expect(row).toMatchObject({ attempts: 5, is_used: 1 });
  }, 30000);
  it('allows exactly one concurrent reset and increments the session version once', async () => {
    const request = await passwordResetService.request(user.username, user.username);
    const verification = await passwordResetService.verify(request.challenge, await mail());
    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        passwordResetService.reset(request.challenge, verification.reset_token!, 'NewPassword123'),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const updated = await User.scope('withPassword').findByPk(user.id);
    expect(updated?.session_version).toBe(1);
    expect(await bcrypt.compare('NewPassword123', updated!.password_hash)).toBe(true);
  }, 30000);
  it('rejects expired OTP and records v1.0 consent in contact and newsletter records', async () => {
    const request = await passwordResetService.request(user.email, user.username);
    const code = await mail();
    await sequelize.query(
      'UPDATE password_reset_otp SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE id=:id',
      { replacements: { id: request.challenge } },
    );
    await expect(passwordResetService.verify(request.challenge, code)).rejects.toThrow();
    const contact = await contactService.create({
      name: 'Test',
      email: user.email,
      phone: '0901234567',
      topic: 'support',
      message: 'Test consent',
      agreed_terms: true,
      website: '',
    });
    expect(contact.agreed_terms_version).toBe('v1.0');
    expect(contact.agreed_terms_at).toBeInstanceOf(Date);
    await newsletterService.subscribe(user.email, '127.0.0.1');
    const subscriber = await NewsletterSubscriber.findOne({ where: { email: user.email } });
    expect(subscriber?.agreed_terms_version).toBe('v1.0');
    expect(subscriber?.agreed_terms_at).toBeInstanceOf(Date);
    await contact.destroy();
    await subscriber?.destroy();
  });
});
