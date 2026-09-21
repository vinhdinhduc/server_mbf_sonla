import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { INotifier } from './INotifier';

/**
 * Cac template email don gian dang dung dang chuoi. Voi quy mo giai doan 1
 * (1 nguoi code, khong can he thong template engine rieng), noi dung duoc
 * dung inline theo templateCode de giu don gian - de bao tri.
 */
export function renderTemplate(
  templateCode: string,
  data: Record<string, any>,
): { subject: string; html: string } {
  const escapeHtml = (value: unknown) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  const branchName = String(data.branch_name ?? 'MobiFone Sơn La').replace(/[\r\n]/g, ' ');
  const hotline = escapeHtml(data.hotline ?? '18001090');
  switch (templateCode) {
    case 'new_registration':
      return {
        subject: `[${branchName}] Có đăng ký mới từ ${String(data.customer_name ?? '').replace(/[\r\n]/g, ' ')}`,
        html: `
          <p>Có một yêu cầu đăng ký mới trên website:</p>
          <ul>
            <li>Khách hàng: ${escapeHtml(data.customer_name)}</li>
            <li>Điện thoại: ${escapeHtml(data.phone)}</li>
            <li>Ghi chú: ${escapeHtml(data.note)}</li>
            <li>Số sản phẩm: ${escapeHtml(data.item_count)}</li>
          </ul>
          <p>Vui lòng đăng nhập trang quản trị để xử lý.</p>
          <p>Hotline: ${hotline}</p>
        `,
      };
    case 'new_contact':
      return {
        subject: `[${branchName}] Có liên hệ mới từ ${String(data.name ?? '').replace(/[\r\n]/g, ' ')}`,
        html: `
          <p>Có một liên hệ mới từ biểu mẫu website:</p>
          <ul>
            <li>Họ tên: ${escapeHtml(data.name)}</li>
            <li>Điện thoại: ${escapeHtml(data.phone)}</li>
            <li>Email: ${escapeHtml(data.email)}</li>
            <li>Nội dung: ${escapeHtml(data.message)}</li>
          </ul>
          <p>Hotline: ${hotline}</p>
        `,
      };
    default:
      return {
        subject: `[${branchName}] Thông báo`,
        html: `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`,
      };
  }
}

export class EmailNotifier implements INotifier {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  async send(recipient: string, templateCode: string, data: Record<string, any>): Promise<void> {
    const { subject, html } = renderTemplate(templateCode, data);
    await this.transporter.sendMail({
      from: env.SMTP_FROM,
      to: recipient,
      subject,
      html,
    });
  }
}
