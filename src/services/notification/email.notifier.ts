import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { INotifier } from './INotifier';

/**
 * Cac template email don gian dang dung dang chuoi. Voi quy mo giai doan 1
 * (1 nguoi code, khong can he thong template engine rieng), noi dung duoc
 * dung inline theo templateCode de giu don gian - de bao tri.
 */
function renderTemplate(
  templateCode: string,
  data: Record<string, any>,
): { subject: string; html: string } {
  switch (templateCode) {
    case 'new_registration':
      return {
        subject: `[MobiFone Son La] Co dang ky moi tu ${data.customer_name}`,
        html: `
          <p>Co mot yeu cau dang ky moi tren website:</p>
          <ul>
            <li>Khach hang: ${data.customer_name}</li>
            <li>Dien thoai: ${data.phone}</li>
            <li>Ghi chu: ${data.note ?? ''}</li>
            <li>So san pham: ${data.item_count}</li>
          </ul>
          <p>Vui long dang nhap trang quan tri de xu ly.</p>
        `,
      };
    case 'new_contact':
      return {
        subject: `[MobiFone Son La] Co lien he moi tu ${data.name}`,
        html: `
          <p>Co mot lien he moi tu form website:</p>
          <ul>
            <li>Ho ten: ${data.name}</li>
            <li>Dien thoai: ${data.phone}</li>
            <li>Email: ${data.email}</li>
            <li>Noi dung: ${data.message}</li>
          </ul>
        `,
      };
    default:
      return {
        subject: `[MobiFone Son La] Thong bao`,
        html: `<pre>${JSON.stringify(data, null, 2)}</pre>`,
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
