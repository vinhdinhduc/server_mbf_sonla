import { consentAudit } from '../utils/legalConsent';
import { randomBytes } from 'crypto';
import ExcelJS from 'exceljs';
import { NewsletterSubscriber } from '../models/NewsletterSubscriber.model';
import { AppError } from '../utils/AppError';
import { emailService } from './email.service';
import { env, ALLOWED_ORIGINS_LIST } from '../config/env';

const site = () => env.PUBLIC_SITE_URL || ALLOWED_ORIGINS_LIST[0] || env.APP_BASE_URL;
export const newsletterService = {
  async subscribe(email: string, ip: string) {
    const normalized = email.toLowerCase();
    let item = await NewsletterSubscriber.findOne({ where: { email: normalized } });
    if (item?.status === 'subscribed') {
      if (!item.agreed_terms_at || !item.agreed_terms_version) await item.update(consentAudit());
      return { id: item.id, email: item.email, status: item.status };
    }
    const confirm = randomBytes(24).toString('hex');
    const unsubscribe = item?.unsubscribe_token || randomBytes(24).toString('hex');
    if (item)
      await item.update({
        status: 'pending',
        confirm_token: confirm,
        unsubscribe_token: unsubscribe,
        consent_ip: ip,
        ...consentAudit(),
      });
    else
      item = await NewsletterSubscriber.create({
        email: normalized,
        status: 'pending',
        confirm_token: confirm,
        unsubscribe_token: unsubscribe,
        consent_ip: ip,
        ...consentAudit(),
      });
    await emailService.unsuppress(normalized);
    await emailService.enqueue(
      normalized,
      'newsletter_confirm',
      { confirm_url: `${site()}/newsletter/xac-nhan?token=${confirm}` },
      `newsletter-confirm:${item.id}:${confirm}`,
    );
    return { id: item.id, email: item.email, status: item.status };
  },
  async confirm(token: string) {
    const item = await NewsletterSubscriber.findOne({ where: { confirm_token: token } });
    if (!item) throw AppError.notFound('Liên kết xác nhận không hợp lệ');
    await item.update({ status: 'subscribed', confirmed_at: new Date(), confirm_token: null });
    await emailService.enqueue(
      item.email,
      'newsletter_welcome',
      { unsubscribe_url: `${site()}/newsletter/huy?token=${item.unsubscribe_token}` },
      `newsletter-welcome:${item.id}`,
    );
    return { email: item.email, status: item.status };
  },
  async unsubscribe(token: string) {
    const item = await NewsletterSubscriber.findOne({ where: { unsubscribe_token: token } });
    if (!item) throw AppError.notFound('Liên kết hủy không hợp lệ');
    await item.update({ status: 'unsubscribed' });
    await emailService.suppress(item.email, 'newsletter_unsubscribe');
    return { email: item.email, status: item.status };
  },
  async list(page: number, pageSize: number) {
    const { rows, count } = await NewsletterSubscriber.findAndCountAll({
      attributes: { exclude: ['confirm_token', 'unsubscribe_token', 'consent_ip'] },
      order: [['subscribed_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items: rows, total: count, page, page_size: pageSize };
  },
  async exportToExcelBuffer() {
    const subscribers = await NewsletterSubscriber.findAll({
      attributes: ['email', 'status', 'subscribed_at', 'confirmed_at'],
      order: [['subscribed_at', 'DESC']],
    });
    if (!subscribers.length) throw AppError.notFound('Không có dữ liệu để xuất');
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Newsletter');
    sheet.columns = [
      { header: 'Email', key: 'email', width: 40 },
      { header: 'Trạng thái', key: 'status', width: 20 },
      { header: 'Ngày đăng ký', key: 'subscribed_at', width: 25 },
      { header: 'Ngày xác nhận', key: 'confirmed_at', width: 25 },
    ];
    subscribers.forEach((s) => sheet.addRow(s.toJSON()));
    return Buffer.from(await wb.xlsx.writeBuffer());
  },
};
