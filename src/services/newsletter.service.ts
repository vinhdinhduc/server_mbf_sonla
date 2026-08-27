import ExcelJS from 'exceljs';
import { NewsletterSubscriber } from '../models/NewsletterSubscriber.model';
import { AppError } from '../utils/AppError';

export const newsletterService = {
  async subscribe(email: string) {
    const existing = await NewsletterSubscriber.findOne({ where: { email } });
    if (existing) {
      if (existing.status === 'unsubscribed') {
        await existing.update({ status: 'subscribed' });
      }
      return existing;
    }
    return NewsletterSubscriber.create({ email });
  },

  async list(page: number, pageSize: number) {
    const { rows, count } = await NewsletterSubscriber.findAndCountAll({
      order: [['subscribed_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items: rows, total: count, page, page_size: pageSize };
  },

  async exportToExcelBuffer(): Promise<Buffer> {
    const subscribers = await NewsletterSubscriber.findAll({ order: [['subscribed_at', 'DESC']] });
    if (subscribers.length === 0) {
      throw AppError.notFound('Khong co du lieu de xuat');
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Newsletter');
    sheet.columns = [
      { header: 'Email', key: 'email', width: 40 },
      { header: 'Trang thai', key: 'status', width: 20 },
      { header: 'Ngay dang ky', key: 'subscribed_at', width: 25 },
    ];
    subscribers.forEach((s) => {
      sheet.addRow({
        email: s.email,
        status: s.status,
        subscribed_at: s.subscribed_at,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },
};
