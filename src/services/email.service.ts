/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { env, ALLOWED_ORIGINS_LIST } from '../config/env';
import { AppError } from '../utils/AppError';
import { sanitizeContent } from '../utils/sanitizeContent';

interface SmtpSettings {
  host: string;
  port: number;
  security: 'none' | 'starttls' | 'ssl';
  username: string;
  password_enc: string | null;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  bcc: string | null;
  send_limit_hour: number;
}
interface Template {
  key: string;
  name: string;
  subject: string;
  html: string;
  enabled: number | boolean;
}
interface OutboxRow {
  id: number;
  recipient: string;
  template_key: string;
  data_json: Record<string, string> | string;
  status: string;
  attempts: number;
}
const key = createHash('sha256').update(env.APP_SECRET_KEY).digest();
const allowedVariables = new Set([
  'customer_name',
  'registration_code',
  'phone',
  'status',
  'message',
  'store_name',
  'hotline',
  'branch_name',
  'item_count',
  'confirm_url',
  'unsubscribe_url',
]);
const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const cleanHeader = (value: string) => value.replace(/[\r\n]/g, ' ').trim();
const masked = (email: string) => email.replace(/^(.{1,2}).*(@.*)$/, '$1***$2');
const emailRegex = /^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/;
const templateDefaults: Record<string, { subject: string; html: string }> = {
  registration_received_customer: {
    subject: 'Xác nhận đăng ký {{registration_code}}',
    html: '<p>Chào {{customer_name}},</p><p>Chúng tôi đã nhận đăng ký <strong>{{registration_code}}</strong> của bạn và sẽ liên hệ sớm.</p>',
  },
  registration_new_staff: {
    subject: 'Đăng ký mới {{registration_code}}',
    html: '<p>Có đăng ký mới {{registration_code}} từ {{customer_name}} ({{phone}}).</p>',
  },
  registration_status_changed: {
    subject: 'Cập nhật đăng ký {{registration_code}}',
    html: '<p>Đăng ký {{registration_code}} đã chuyển sang trạng thái {{status}}.</p>',
  },
  contact_new_staff: {
    subject: 'Liên hệ mới từ {{customer_name}}',
    html: '<p>{{customer_name}} ({{phone}}) gửi liên hệ: {{message}}</p>',
  },
  contact_received_customer: {
    subject: 'Đã nhận liên hệ của bạn',
    html: '<p>Chào {{customer_name}}, chúng tôi đã nhận nội dung của bạn.</p>',
  },
  appointment_confirmed: {
    subject: 'Xác nhận lịch hẹn tại {{store_name}}',
    html: '<p>Chào {{customer_name}}, lịch hẹn của bạn tại {{store_name}} đã được ghi nhận.</p>',
  },
  appointment_new_staff: {
    subject: 'Lịch hẹn mới tại {{store_name}}',
    html: '<p>Có lịch hẹn mới của {{customer_name}} tại {{store_name}}.</p>',
  },
  account_created: {
    subject: 'Tài khoản quản trị đã được tạo',
    html: '<p>Chào {{customer_name}}, tài khoản của bạn đã được tạo.</p>',
  },
};

export function encryptSmtpPassword(password: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const content = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${content.toString('base64')}`;
}
export function decryptSmtpPassword(value: string): string {
  const [iv, tag, content] = value.split('.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(content, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
export function renderEmail(template: Template, data: Record<string, unknown>) {
  const replace = (_: string, variable: string) =>
    allowedVariables.has(variable) ? escapeHtml(data[variable]) : '';
  const subject = cleanHeader(
    template.subject.replace(/{{\s*([a-z_]+)\s*}}/g, (_match, variable) =>
      allowedVariables.has(variable) ? cleanHeader(String(data[variable] ?? '')) : '',
    ),
  );
  const body = sanitizeContent(template.html.replace(/{{\s*([a-z_]+)\s*}}/g, replace));
  const site = env.PUBLIC_SITE_URL || ALLOWED_ORIGINS_LIST[0] || '';
  const logo = site
    ? `<div style="background:#0066b3;padding:16px"><img src="${escapeHtml(site.replace(/\/$/, ''))}/logo.png" alt="MobiFone Sơn La" width="160" /></div>`
    : '';
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto">${logo}<hr/>${body}<hr/><p>MobiFone Sơn La · Hotline 18001090</p></div>`;
  return {
    subject,
    html,
    text: html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  };
}

async function settings(): Promise<SmtpSettings> {
  const rows = await sequelize.query<SmtpSettings>('SELECT * FROM email_smtp_settings WHERE id=1', {
    type: QueryTypes.SELECT,
  });
  return (
    rows[0] || {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      security: env.SMTP_PORT === 465 ? 'ssl' : 'starttls',
      username: env.SMTP_USER,
      password_enc: null,
      from_name: 'MobiFone Sơn La',
      from_email: env.SMTP_FROM,
      reply_to: null,
      bcc: null,
      send_limit_hour: 200,
    }
  );
}
async function transport(config?: SmtpSettings) {
  const setting = config || await settings();
  const password = setting.password_enc ? decryptSmtpPassword(setting.password_enc) : env.SMTP_PASS;
  if (!setting.host || !setting.username || !password || !emailRegex.test(setting.from_email)) {
    throw AppError.badRequest('Chưa cấu hình SMTP đầy đủ. Vui lòng nhập host, tài khoản, mật khẩu và email gửi tại mục Email & thông báo.');
  }
  const transporter = nodemailer.createTransport({
    host: setting.host,
    port: Number(setting.port),
    secure: setting.security === 'ssl',
    requireTLS: setting.security === 'starttls',
    auth: { user: setting.username, pass: password },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });
  return { transporter, setting };
}

async function smtpOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) throw error;
    const code = (error as { code?: string })?.code;
    const messages: Record<string, string> = {
      EAUTH: 'Xác thực SMTP thất bại. Kiểm tra tài khoản và mật khẩu SMTP.',
      ECONNECTION: 'Không kết nối được máy chủ SMTP. Kiểm tra host và port.',
      ESOCKET: 'Kết nối SMTP thất bại. Kiểm tra host, port và cấu hình TLS.',
      ETIMEDOUT: 'Máy chủ SMTP không phản hồi trong thời gian cho phép.',
      EDNS: 'Không tìm thấy máy chủ SMTP. Kiểm tra host.',
      ETLS: 'Không thiết lập được kết nối TLS với máy chủ SMTP.',
      EENVELOPE: 'Máy chủ SMTP từ chối địa chỉ gửi hoặc nhận.',
      EMESSAGE: 'Máy chủ SMTP từ chối nội dung thư.',
    };
    throw new AppError(messages[code || ''] || 'Gửi email thất bại. Kiểm tra cấu hình SMTP và thử lại.', 502);
  }
}

export const emailService = {
  async sendPasswordReset(recipient: string, code: string) {
    if (!emailRegex.test(recipient)) throw AppError.badRequest('Email không hợp lệ');
    const { transporter, setting } = await transport();
    const rendered = renderEmail({ key: 'password_reset', name: 'Đặt lại mật khẩu', enabled: true,
      subject: 'Mã xác thực đặt lại mật khẩu MobiFone',
      html: `<h1>Đặt lại mật khẩu</h1><p>Mã OTP của bạn:</p><p style="font-size:32px;color:#0066b3;letter-spacing:6px"><strong>${escapeHtml(code)}</strong></p><p>Mã có hiệu lực 5 phút. Không chia sẻ mã này với bất kỳ ai. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
    }, {});
    await transporter.sendMail({ from: { name: cleanHeader(setting.from_name), address: setting.from_email }, to: recipient, ...rendered });
  },
  async config() {
    const setting = await settings();
    return {
      ...setting,
      password_enc: undefined,
      password_configured: Boolean(setting.password_enc || env.SMTP_PASS),
    };
  },
  async saveConfig(
    input: Omit<SmtpSettings, 'password_enc' | 'reply_to' | 'bcc'> & {
      password?: string;
      reply_to?: string | null;
      bcc?: string | null;
    },
  ) {
    if (
      !emailRegex.test(input.from_email) ||
      (input.reply_to && !emailRegex.test(input.reply_to)) ||
      (input.bcc && !emailRegex.test(input.bcc))
    )
      throw AppError.badRequest('Địa chỉ email không hợp lệ');
    const old = await settings();
    const password = input.password ? encryptSmtpPassword(input.password) : old.password_enc;
    await sequelize.query(
      'INSERT INTO email_smtp_settings(id,host,port,security,username,password_enc,from_name,from_email,reply_to,bcc,send_limit_hour,updated_at) VALUES (1,:host,:port,:security,:username,:password,:fromName,:fromEmail,:replyTo,:bcc,:limit,NOW()) ON DUPLICATE KEY UPDATE host=VALUES(host),port=VALUES(port),security=VALUES(security),username=VALUES(username),password_enc=VALUES(password_enc),from_name=VALUES(from_name),from_email=VALUES(from_email),reply_to=VALUES(reply_to),bcc=VALUES(bcc),send_limit_hour=VALUES(send_limit_hour),updated_at=NOW()',
      {
        replacements: {
          host: input.host,
          port: input.port,
          security: input.security,
          username: input.username,
          password,
          fromName: cleanHeader(input.from_name),
          fromEmail: cleanHeader(input.from_email),
          replyTo: input.reply_to || null,
          bcc: input.bcc || null,
          limit: input.send_limit_hour,
        },
      },
    );
    return this.config();
  },
  async verify() {
    const { transporter } = await transport();
    await smtpOperation(() => transporter.verify());
    return { ok: true };
  },
  async sendTest(recipient: string) {
    if (!emailRegex.test(recipient)) throw AppError.badRequest('Email không hợp lệ');
    const { transporter, setting } = await transport();
    await smtpOperation(() => transporter.sendMail({
      from: { name: cleanHeader(setting.from_name), address: setting.from_email },
      to: recipient,
      replyTo: setting.reply_to || undefined,
      ...renderEmail(
        {
          key: 'test',
          name: 'test',
          enabled: true,
          subject: 'Kiểm tra email MobiFone Sơn La',
          html: '<p>Thư thử nghiệm tiếng Việt: MobiFone Sơn La.</p>',
        },
        {},
      ),
    }));
    return { sent: true, recipient: masked(recipient) };
  },
  async templates() {
    return sequelize.query<Template>('SELECT * FROM email_templates ORDER BY `key`', {
      type: QueryTypes.SELECT,
    });
  },
  async saveTemplate(
    templateKey: string,
    input: { subject: string; html: string; enabled: boolean },
  ) {
    const rows = await sequelize.query<Template>('SELECT * FROM email_templates WHERE `key`=:key', {
      replacements: { key: templateKey },
      type: QueryTypes.SELECT,
    });
    if (!rows[0]) throw AppError.notFound('Mẫu thư không tồn tại');
    const variables = [...`${input.subject} ${input.html}`.matchAll(/{{\s*([a-z_]+)\s*}}/g)].map(
      (match) => match[1],
    );
    if (variables.some((variable) => !allowedVariables.has(variable)))
      throw AppError.badRequest('Mẫu thư chứa biến không được hỗ trợ');
    await sequelize.query(
      'UPDATE email_templates SET subject=:subject,html=:html,enabled=:enabled,updated_at=NOW() WHERE `key`=:key',
      {
        replacements: {
          subject: cleanHeader(input.subject),
          html: sanitizeContent(input.html),
          enabled: input.enabled,
          key: templateKey,
        },
      },
    );
  },
  async preview(templateKey: string, data: Record<string, unknown> = {}) {
    const rows = await sequelize.query<Template>('SELECT * FROM email_templates WHERE `key`=:key', {
      replacements: { key: templateKey },
      type: QueryTypes.SELECT,
    });
    if (!rows[0]) throw AppError.notFound('Mẫu thư không tồn tại');
    return renderEmail(rows[0], {
      customer_name: 'Nguyễn Văn A',
      registration_code: 'DK-260922-0001',
      phone: '0901234567',
      store_name: 'MobiFone Sơn La',
      hotline: '18001090',
      ...data,
    });
  },
  async restoreTemplate(templateKey: string) {
    const preset = templateDefaults[templateKey];
    if (!preset) throw AppError.notFound('Mẫu thư không tồn tại');
    await this.saveTemplate(templateKey, { ...preset, enabled: true });
  },
  async enqueue(
    recipient: string | null | undefined,
    templateKey: string,
    data: Record<string, unknown>,
    idempotencyKey: string,
  ) {
    if (!recipient || !emailRegex.test(recipient)) return;
    const rows = await sequelize.query<Template>(
      'SELECT `key`,enabled FROM email_templates WHERE `key`=:key',
      { replacements: { key: templateKey }, type: QueryTypes.SELECT },
    );
    if (!rows[0] || !rows[0].enabled) return;
    const allowedData = Object.fromEntries(
      Object.entries(data)
        .filter(([name]) => allowedVariables.has(name))
        .map(([name, value]) => [name, String(value ?? '').slice(0, 1000)]),
    );
    await sequelize.query(
      "INSERT IGNORE INTO email_outbox(idempotency_key,recipient,template_key,data_json,status,attempts,next_attempt_at,created_at) VALUES (:id,:recipient,:template,:data,'queued',0,NOW(),NOW())",
      {
        replacements: {
          id: idempotencyKey,
          recipient: recipient.toLowerCase(),
          template: templateKey,
          data: JSON.stringify(allowedData),
        },
      },
    );
  },
  async logs(page = 1) {
    const rows = await sequelize.query<OutboxRow>(
      'SELECT id,recipient,template_key,status,attempts,last_error,created_at,sent_at FROM email_outbox ORDER BY id DESC LIMIT 50 OFFSET :offset',
      { replacements: { offset: (page - 1) * 50 }, type: QueryTypes.SELECT },
    );
    return rows.map((row) => ({ ...row, recipient: masked(row.recipient) }));
  },
  async retry(id: number) {
    await sequelize.query(
      "UPDATE email_outbox SET status='queued',attempts=0,next_attempt_at=NOW(),last_error=NULL,claim_token=NULL,locked_at=NULL WHERE id=:id AND status IN ('failed','suppressed')",
      { replacements: { id } },
    );
  },
  async suppress(email: string, reason: string) {
    if (!emailRegex.test(email)) throw AppError.badRequest('Email không hợp lệ');
    await sequelize.query(
      'INSERT INTO email_suppressions(email,reason,created_at) VALUES (:email,:reason,NOW()) ON DUPLICATE KEY UPDATE reason=VALUES(reason)',
      { replacements: { email: email.toLowerCase(), reason } },
    );
  },
  async unsuppress(email: string) {
    await sequelize.query('DELETE FROM email_suppressions WHERE email=:email', {
      replacements: { email: email.toLowerCase() },
    });
  },
  async suppressions() {
    return sequelize.query<{ email: string; reason: string }>(
      'SELECT email,reason FROM email_suppressions ORDER BY created_at DESC',
      { type: QueryTypes.SELECT },
    );
  },
};

export async function processEmailOutbox() {
  await sequelize.query(
    "UPDATE email_outbox SET status='queued',claim_token=NULL WHERE status='processing' AND locked_at<DATE_SUB(NOW(),INTERVAL 5 MINUTE)",
  );
  const rows = await sequelize.query<OutboxRow>(
    "SELECT id,recipient,template_key,data_json,status,attempts FROM email_outbox WHERE status='queued' AND next_attempt_at<=NOW() ORDER BY id LIMIT 10",
    { type: QueryTypes.SELECT },
  );
  for (const row of rows) {
    const claim = randomUUID();
    const [result] = await sequelize.query(
      "UPDATE email_outbox SET status='processing',locked_at=NOW(),claim_token=:claim WHERE id=:id AND status='queued'",
      { replacements: { claim, id: row.id } },
    );
    if (!(result as { affectedRows?: number }).affectedRows) continue;
    try {
      const suppressed = await sequelize.query(
        'SELECT email FROM email_suppressions WHERE email=:email',
        { replacements: { email: row.recipient }, type: QueryTypes.SELECT },
      );
      if (suppressed.length) {
        await sequelize.query(
          "UPDATE email_outbox SET status='suppressed' WHERE id=:id AND claim_token=:claim",
          { replacements: { id: row.id, claim } },
        );
        continue;
      }
      const templates = await sequelize.query<Template>(
        'SELECT * FROM email_templates WHERE `key`=:key',
        { replacements: { key: row.template_key }, type: QueryTypes.SELECT },
      );
      if (!templates[0] || !templates[0].enabled) {
        await sequelize.query(
          "UPDATE email_outbox SET status='suppressed' WHERE id=:id AND claim_token=:claim",
          { replacements: { id: row.id, claim } },
        );
        continue;
      }
      const setting = await settings();
      const sent = await sequelize.query<{ count: number }>(
        "SELECT COUNT(*) AS count FROM email_outbox WHERE status='sent' AND sent_at>DATE_SUB(NOW(),INTERVAL 1 HOUR)",
        { type: QueryTypes.SELECT },
      );
      if (Number(sent[0].count) >= setting.send_limit_hour) {
        await sequelize.query(
          "UPDATE email_outbox SET status='queued',next_attempt_at=DATE_ADD(NOW(),INTERVAL 5 MINUTE),claim_token=NULL WHERE id=:id AND claim_token=:claim",
          { replacements: { id: row.id, claim } },
        );
        continue;
      }
      const { transporter } = await transport(setting);
      const data = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
      const rendered = renderEmail(templates[0], data);
      const delivery = await transporter.sendMail({
        from: { name: cleanHeader(setting.from_name), address: setting.from_email },
        to: row.recipient,
        replyTo: setting.reply_to || undefined,
        bcc: setting.bcc || undefined,
        ...rendered,
      });
      // SMTP may accept only the internal BCC while rejecting the customer.
      if (delivery.rejected?.some((address) => String(address).toLowerCase() === row.recipient.toLowerCase())) {
        throw Object.assign(new Error('Recipient rejected'), { code: 'EENVELOPE' });
      }
      await sequelize.query(
        "UPDATE email_outbox SET status='sent',attempts=attempts+1,sent_at=NOW(),claim_token=NULL,last_error=NULL WHERE id=:id AND claim_token=:claim",
        { replacements: { id: row.id, claim } },
      );
    } catch (error) {
      const attempt = Number(row.attempts) + 1;
      const delay = Math.min(3600, 30 * 2 ** (attempt - 1));
      const code =
        typeof error === 'object' && error && 'code' in error
          ? String((error as { code: unknown }).code).slice(0, 40)
          : 'SEND_ERROR';
      await sequelize.query(
        'UPDATE email_outbox SET status=:status,attempts=:attempts,next_attempt_at=DATE_ADD(NOW(),INTERVAL :delay SECOND),last_error=:error,claim_token=NULL WHERE id=:id AND claim_token=:claim',
        {
          replacements: {
            status: attempt >= 3 ? 'failed' : 'queued',
            attempts: attempt,
            delay,
            error: code,
            id: row.id,
            claim,
          },
        },
      );
    }
  }
}

let running = false;
export function scheduleEmailWorker() {
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processEmailOutbox();
    } catch {
      /* DB unavailable: retry next tick */
    } finally {
      running = false;
    }
  }, 15_000);
  timer.unref();
}
