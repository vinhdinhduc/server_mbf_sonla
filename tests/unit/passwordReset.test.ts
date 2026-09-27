import { createHmac } from 'crypto';
import bcrypt from 'bcrypt';
import { sequelize } from '../../src/config/database';
import { User } from '../../src/models/User.model';
import { passwordResetService } from '../../src/services/passwordReset.service';
import { emailService } from '../../src/services/email.service';
import { resetPasswordSchema } from '../../src/validators/auth.validator';

jest.mock('../../src/config/env', () => ({ env: { APP_SECRET_KEY: 'test-secret' } }));
jest.mock('../../src/config/database', () => ({
  sequelize: { query: jest.fn(), transaction: jest.fn() },
}));
jest.mock('../../src/models/User.model', () => ({
  User: { findAll: jest.fn(), findByPk: jest.fn() },
}));
jest.mock('../../src/services/email.service', () => ({
  emailService: { sendPasswordReset: jest.fn().mockResolvedValue(undefined) },
}));
const challenge = 'a'.repeat(64);
let row: any;
let buckets: Map<string, string>;
let account: any;
const query = sequelize.query as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  buckets = new Map();
  row = undefined;
  account = {
    id: 7,
    email: 'customer@example.com',
    status: 'active',
    session_version: 2,
    update: jest.fn().mockImplementation(async (value) => Object.assign(account, value)),
  };
  (User.findAll as jest.Mock).mockResolvedValue([account]);
  (User.findByPk as jest.Mock).mockResolvedValue(account);
  (sequelize.transaction as jest.Mock).mockImplementation(async (work) =>
    work({ LOCK: { UPDATE: 'UPDATE' } }),
  );
  query.mockImplementation(async (sql: string, options: any) => {
    const p = options?.replacements || {};
    if (sql.startsWith('SELECT hits')) return [{ hits: buckets.get(p.key) || '[]' }];
    if (sql.startsWith('UPDATE password_reset_limits')) buckets.set(p.key, p.hits);
    if (sql.startsWith('SELECT * FROM password_reset_otp')) return row ? [row] : [];
    if (sql.startsWith('INSERT INTO password_reset_otp'))
      row = {
        id: p.id,
        user_id: p.user,
        otp_code: p.code,
        expires_at: p.expires,
        is_used: false,
        attempts: 0,
        reset_token_hash: null,
      };
    if (sql.includes('SET attempts='))
      Object.assign(row, { attempts: p.attempts, is_used: p.used });
    if (sql.includes('SET reset_token_hash=')) row.reset_token_hash = p.token;
    if (sql.includes('SET is_used=1') && row)
      Object.assign(row, { is_used: true, reset_token_hash: null });
    return [];
  });
});
function validOtp() {
  row = {
    id: challenge,
    user_id: 7,
    otp_code: createHmac('sha256', 'test-secret').update(`${challenge}:123456`).digest('hex'),
    expires_at: new Date(Date.now() + 300000),
    is_used: false,
    attempts: 0,
    reset_token_hash: null,
  };
}
it('returns the same public shape for existing and unknown accounts; stores only an OTP HMAC', async () => {
  const existing = await passwordResetService.request('customer@example.com', '1');
  await new Promise(setImmediate);
  expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
    account.email,
    expect.stringMatching(/^\d{6}$/),
  );
  expect(row.otp_code).toMatch(/^[a-f0-9]{64}$/);
  expect(row.otp_code).not.toBe((emailService.sendPasswordReset as jest.Mock).mock.calls[0][1]);
  (User.findAll as jest.Mock).mockResolvedValue([]);
  const unknown = await passwordResetService.request('missing@example.com', '1');
  expect({ ...existing, challenge: '' }).toEqual({ ...unknown, challenge: '' });
  expect(unknown.challenge).toHaveLength(64);
});
it('shares the cooldown and rolling 3/hour limit between username and email', async () => {
  const clock = jest.spyOn(Date, 'now');
  const start = Date.now();
  clock.mockReturnValue(start);
  try {
    await passwordResetService.request('username', '1');
    await passwordResetService.request('customer@example.com', '2');
    clock.mockReturnValue(start + 61000);
    await passwordResetService.request('username', '1');
    clock.mockReturnValue(start + 122000);
    await passwordResetService.request('customer@example.com', '2');
    clock.mockReturnValue(start + 183000);
    await passwordResetService.request('username', '3');
    await new Promise(setImmediate);
    expect(emailService.sendPasswordReset).toHaveBeenCalledTimes(3);
  } finally {
    clock.mockRestore();
  }
});
it('commits all five failed attempts and rejects a correct code afterwards', async () => {
  validOtp();
  for (let i = 0; i < 5; i += 1)
    await expect(passwordResetService.verify(challenge, '000000')).rejects.toThrow();
  expect(row.attempts).toBe(5);
  expect(row.is_used).toBe(true);
  await expect(passwordResetService.verify(challenge, '123456')).rejects.toThrow();
});
it('rejects expired and used codes and cannot reset without verifying first', async () => {
  validOtp();
  await expect(
    passwordResetService.reset(challenge, 'b'.repeat(64), 'Password123'),
  ).rejects.toThrow();
  row.expires_at = new Date(Date.now() - 1);
  await expect(passwordResetService.verify(challenge, '123456')).rejects.toThrow();
  validOtp();
  row.is_used = true;
  await expect(passwordResetService.verify(challenge, '123456')).rejects.toThrow();
});
it('issues a one-use reset token, hashes the password, consumes OTP and revokes old sessions', async () => {
  validOtp();
  const result = await passwordResetService.verify(challenge, '123456');
  expect(row.reset_token_hash).not.toBe(result.reset_token);
  await expect(passwordResetService.verify(challenge, '123456')).rejects.toThrow();
  await expect(
    passwordResetService.reset(challenge, 'b'.repeat(64), 'Password123'),
  ).rejects.toThrow();
  await passwordResetService.reset(challenge, result.reset_token!, 'Password123');
  expect(await bcrypt.compare('Password123', account.password_hash)).toBe(true);
  expect(account.session_version).toBe(3);
  expect(row.is_used).toBe(true);
  await expect(
    passwordResetService.reset(challenge, result.reset_token!, 'Password123'),
  ).rejects.toThrow();
});
it.each(['short1A', 'PASSWORD123', 'password123', 'Passwordonly', 'Á'.repeat(40) + 'aA1'])(
  'rejects weak/overlong password %s',
  (password) => {
    expect(
      resetPasswordSchema.safeParse({
        challenge,
        reset_token: challenge,
        password,
        confirm_password: password,
      }).success,
    ).toBe(false);
  },
);
it('rejects a mismatching confirmation', () => {
  expect(
    resetPasswordSchema.safeParse({
      challenge,
      reset_token: challenge,
      password: 'Password123',
      confirm_password: 'Password124',
    }).success,
  ).toBe(false);
});
