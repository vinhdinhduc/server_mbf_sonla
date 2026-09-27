import nodemailer from 'nodemailer';
import { sequelize } from '../../src/config/database';
import { emailService, encryptSmtpPassword } from '../../src/services/email.service';

jest.mock('../../src/config/env', () => ({
  env: { APP_SECRET_KEY: 'test-key', PUBLIC_SITE_URL: 'https://mobifone.example', SMTP_PASS: 'unused' },
  ALLOWED_ORIGINS_LIST: [],
}));
jest.mock('../../src/config/database', () => ({ sequelize: { query: jest.fn() } }));
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

it('uses the admin SMTP settings and branded template without copying OTP to BCC or outbox', async () => {
  const sendMail = jest.fn().mockResolvedValue({});
  (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  (sequelize.query as jest.Mock).mockResolvedValue([{
    host: 'smtp.admin.example', port: 587, security: 'starttls', username: 'configured-user',
    password_enc: encryptSmtpPassword('configured-password'), from_name: 'MobiFone Sơn La',
    from_email: 'support@example.com', bcc: 'staff@example.com',
  }]);
  await emailService.sendPasswordReset('customer@example.com', '012345');
  expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
    host: 'smtp.admin.example', port: 587, requireTLS: true,
    auth: { user: 'configured-user', pass: 'configured-password' },
  }));
  const message = sendMail.mock.calls[0][0];
  expect(message.to).toBe('customer@example.com');
  expect(message.html).toContain('https://mobifone.example/logo.png');
  expect(message.html).toContain('012345');
  expect(message.html).toContain('5 phút');
  expect(message.text).toContain('012345');
  expect(message).not.toHaveProperty('bcc');
  expect(sequelize.query).toHaveBeenCalledTimes(1);
});
