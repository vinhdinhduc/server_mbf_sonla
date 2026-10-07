import nodemailer from 'nodemailer';
import { sequelize } from '../../src/config/database';
import { emailService, processEmailOutbox, renderEmail } from '../../src/services/email.service';
import { settingService } from '../../src/services/setting.service';

jest.mock('../../src/config/env', () => ({
  env: {
    APP_SECRET_KEY: 'test-key',
    APP_BASE_URL: 'https://mobifone-sonla.vn',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: 587,
    SMTP_USER: 'user',
    SMTP_PASS: 'secret',
    SMTP_FROM: 'sender@example.com',
  },
  ALLOWED_ORIGINS_LIST: [],
}));
jest.mock('../../src/config/database', () => ({ sequelize: { query: jest.fn() } }));
jest.mock('../../src/services/setting.service', () => ({
  settingService: { listPublic: jest.fn() },
}));
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const query = sequelize.query as jest.Mock;
const sendMail = jest.fn();
const verify = jest.fn();
const listPublicSettings = settingService.listPublic as jest.Mock;
beforeEach(() => {
  query.mockReset().mockResolvedValue([]);
  sendMail.mockReset().mockResolvedValue({ accepted: ['customer@example.com'], rejected: [] });
  verify.mockReset().mockResolvedValue(true);
  listPublicSettings.mockReset().mockResolvedValue({});
  (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail, verify });
});

it('sends both HTML and text with environment SMTP settings when no admin config exists', async () => {
  await expect(emailService.sendTest('customer@example.com')).resolves.toMatchObject({
    sent: true,
  });
  expect(nodemailer.createTransport).toHaveBeenCalledWith(
    expect.objectContaining({
      host: 'smtp.example.com',
      secure: false,
      requireTLS: true,
      auth: { user: 'user', pass: 'secret' },
    }),
  );
  expect(sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      from: { name: 'MobiFone Sơn La', address: 'sender@example.com' },
      text: expect.stringContaining('Thư thử nghiệm tiếng Việt'),
      html: expect.stringContaining('Thư thử nghiệm tiếng Việt'),
    }),
  );
});

it('sends the current draft with sample variables inside the shared email wrapper', async () => {
  listPublicSettings.mockResolvedValue({
    footer_branch_name: 'Chi nhánh Sơn La',
    contact_address: '96B Đường 3/2, Phường Tô Hiệu, Tỉnh Sơn La',
    footer_address: 'Tổ 3, Phường Chiềng Lề',
    working_hours: '07:30–19:00',
    footer_working_hours: '07:30–17:30',
    footer_copyright: 'MobiFone Sơn La',
    email_logo_url: 'https://mobifone-sonla.vn/uploads/brand.png',
  });
  await emailService.sendTest('customer@example.com', {
    key: 'registration_received_customer',
    subject: 'Đăng ký {{registration_code}}',
    html: '<script>alert(1)</script><p onclick="run()">Chào {{customer_name}}</p>',
  });
  const message = sendMail.mock.calls[0][0];
  expect(message.subject).toBe('Đăng ký DK-2025-0001');
  expect(message.html).toContain('width="600"');
  expect(message.html).toContain('Chào Nguyễn Văn A');
  expect(message.html).toContain('Chi nhánh Sơn La');
  expect(message.html).toContain('96B Đường 3/2, Phường Tô Hiệu, Tỉnh Sơn La');
  expect(message.html).not.toContain('Tổ 3, Phường Chiềng Lề');
  expect(message.html).toContain('07:30–19:00');
  expect(message.html).not.toContain('07:30–17:30');
  expect(message.html).toContain('https://mobifone-sonla.vn/uploads/brand.png');
  expect(message.html).not.toContain('<script');
  expect(message.html).not.toContain('onclick');
});

it('renders registration status codes in Vietnamese', () => {
  const rendered = renderEmail(
    {
      key: 'registration_status_changed',
      name: 'Cập nhật trạng thái',
      enabled: true,
      subject: 'Trạng thái {{status}}',
      html: '<p>{{status}}</p>',
    },
    { status: 'hoan_thanh' },
  );
  expect(rendered.subject).toBe('Trạng thái Hoàn tất');
  expect(rendered.html).toContain('>Hoàn tất<');
});

it('hides optional rows and escapes customer-controlled values', () => {
  const rendered = renderEmail(
    {
      key: 'contact_new_staff',
      name: 'Liên hệ mới',
      enabled: true,
      subject: 'Liên hệ mới',
      html: '<table><tbody><tr><td>Điện thoại</td><td>{{phone}}</td></tr></tbody></table><blockquote>{{message}}</blockquote><p>{{customer_name}}</p>',
    },
    {
      phone: '',
      message: '<script>alert(1)</script>',
      customer_name: '<img src=x onerror=alert(1)>',
    },
  );
  expect(rendered.html).not.toContain('Điện thoại');
  expect(rendered.html).not.toContain('<script');
  expect(rendered.html).not.toContain('<img src=x');
  expect(rendered.html).toContain('&lt;script&gt;');
  expect(rendered.html).toContain('&lt;img');
  expect(rendered.html).not.toMatch(/{{\s*[a-z_]+\s*}}/);
  const empty = renderEmail(
    {
      key: 'contact_new_staff',
      name: 'Liên hệ',
      enabled: true,
      subject: 'Liên hệ',
      html: '<table><tbody><tr><td>Điện thoại</td><td>{{phone}}</td></tr></tbody></table><blockquote>{{message}}</blockquote><p>Xin chào {{customer_name}},</p>',
    },
    { phone: '', message: '', customer_name: '' },
  );
  expect(empty.html).not.toContain('Điện thoại');
  expect(empty.html).not.toContain('<blockquote');
  expect(empty.html).not.toContain('Xin chào');
  expect(empty.html).not.toContain('<table><tbody></tbody></table>');
});

it('never emits localhost logo URLs and uses an absolute public PNG fallback', () => {
  const rendered = renderEmail(
    {
      key: 'account_created',
      name: 'Tài khoản',
      enabled: true,
      subject: 'Tài khoản đã tạo',
      html: '<p>Đã tạo</p><a href="/admin/login">Đăng nhập</a><a href="{{confirm_url}}">Tiếp tục</a>',
    },
    {
      email_footer: { logo: 'http://localhost:3000/logo.png' },
      confirm_url: 'http://localhost:3000/admin/login',
    },
  );
  expect(rendered.html).not.toContain('localhost');
  expect(rendered.html).toContain('https://mobifone-sonla.vn/logo.png');
  expect(rendered.html).toContain('href="https://mobifone-sonla.vn/admin/login"');
  expect(rendered.html).toContain('alt="MobiFone Sơn La" width="200" height="37"');
  expect(rendered.html).toContain('© 2026');
});

it('reports authentication failure without exposing raw SMTP errors', async () => {
  verify.mockRejectedValue(Object.assign(new Error('secret SMTP response'), { code: 'EAUTH' }));
  await expect(emailService.verify()).rejects.toMatchObject({
    statusCode: 502,
    message: 'Xác thực SMTP thất bại. Kiểm tra tài khoản và mật khẩu SMTP.',
  });
});

it('rejects incomplete admin settings before opening a connection', async () => {
  query.mockResolvedValue([{ host: '', username: '', from_email: '' }]);
  await expect(emailService.sendTest('customer@example.com')).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(sendMail).not.toHaveBeenCalled();
});

it('gives a manually retried message a fresh retry budget', async () => {
  await emailService.retry(12);
  expect(query).toHaveBeenCalledWith(expect.stringContaining('attempts=0'), {
    replacements: { id: 12 },
  });
});

it('retries when the primary recipient is rejected even if BCC was accepted', async () => {
  query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT id,recipient'))
      return [
        {
          id: 1,
          recipient: 'customer@example.com',
          template_key: 'test',
          data_json: {},
          status: 'queued',
          attempts: 0,
        },
      ];
    if (sql.includes("SET status='processing'")) return [{ affectedRows: 1 }];
    if (sql.includes('SELECT * FROM email_templates'))
      return [{ key: 'test', enabled: true, subject: 'Test', html: '<p>Test</p>' }];
    if (sql.includes('SELECT COUNT(*)')) return [{ count: 0 }];
    return [];
  });
  sendMail.mockResolvedValue({
    accepted: ['staff@example.com'],
    rejected: ['customer@example.com'],
  });
  await processEmailOutbox();
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining('SET status=:status'),
    expect.objectContaining({
      replacements: expect.objectContaining({ status: 'queued', attempts: 1, error: 'EENVELOPE' }),
    }),
  );
  expect(query.mock.calls.some(([sql]) => sql.includes("SET status='sent'"))).toBe(false);
});
