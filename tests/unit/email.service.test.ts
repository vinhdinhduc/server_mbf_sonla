import nodemailer from 'nodemailer';
import { sequelize } from '../../src/config/database';
import { emailService, processEmailOutbox } from '../../src/services/email.service';

jest.mock('../../src/config/env', () => ({
  env: { APP_SECRET_KEY: 'test-key', SMTP_HOST: 'smtp.example.com', SMTP_PORT: 587,
    SMTP_USER: 'user', SMTP_PASS: 'secret', SMTP_FROM: 'sender@example.com' },
  ALLOWED_ORIGINS_LIST: [],
}));
jest.mock('../../src/config/database', () => ({ sequelize: { query: jest.fn() } }));
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const query = sequelize.query as jest.Mock;
const sendMail = jest.fn();
const verify = jest.fn();
beforeEach(() => {
  query.mockReset().mockResolvedValue([]);
  sendMail.mockReset().mockResolvedValue({ accepted: ['customer@example.com'], rejected: [] });
  verify.mockReset().mockResolvedValue(true);
  (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail, verify });
});

it('sends both HTML and text with environment SMTP settings when no admin config exists', async () => {
  await expect(emailService.sendTest('customer@example.com')).resolves.toMatchObject({ sent: true });
  expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
    host: 'smtp.example.com', secure: false, requireTLS: true,
    auth: { user: 'user', pass: 'secret' },
  }));
  expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
    from: { name: 'MobiFone Sơn La', address: 'sender@example.com' },
    text: expect.stringContaining('Thư thử nghiệm tiếng Việt'),
    html: expect.stringContaining('Thư thử nghiệm tiếng Việt'),
  }));
});

it('reports authentication failure without exposing raw SMTP errors', async () => {
  verify.mockRejectedValue(Object.assign(new Error('secret SMTP response'), { code: 'EAUTH' }));
  await expect(emailService.verify()).rejects.toMatchObject({
    statusCode: 502, message: 'Xác thực SMTP thất bại. Kiểm tra tài khoản và mật khẩu SMTP.',
  });
});

it('rejects incomplete admin settings before opening a connection', async () => {
  query.mockResolvedValue([{ host: '', username: '', from_email: '' }]);
  await expect(emailService.sendTest('customer@example.com')).rejects.toMatchObject({ statusCode: 400 });
  expect(sendMail).not.toHaveBeenCalled();
});

it('gives a manually retried message a fresh retry budget', async () => {
  await emailService.retry(12);
  expect(query).toHaveBeenCalledWith(expect.stringContaining('attempts=0'), { replacements: { id: 12 } });
});

it('retries when the primary recipient is rejected even if BCC was accepted', async () => {
  query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT id,recipient')) return [{ id: 1, recipient: 'customer@example.com',
      template_key: 'test', data_json: {}, status: 'queued', attempts: 0 }];
    if (sql.includes("SET status='processing'")) return [{ affectedRows: 1 }];
    if (sql.includes('SELECT * FROM email_templates')) return [{ key: 'test', enabled: true, subject: 'Test', html: '<p>Test</p>' }];
    if (sql.includes('SELECT COUNT(*)')) return [{ count: 0 }];
    return [];
  });
  sendMail.mockResolvedValue({ accepted: ['staff@example.com'], rejected: ['customer@example.com'] });
  await processEmailOutbox();
  expect(query).toHaveBeenCalledWith(expect.stringContaining('SET status=:status'), expect.objectContaining({
    replacements: expect.objectContaining({ status: 'queued', attempts: 1, error: 'EENVELOPE' }),
  }));
  expect(query.mock.calls.some(([sql]) => sql.includes("SET status='sent'"))).toBe(false);
});
