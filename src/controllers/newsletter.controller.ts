import { Request, Response } from 'express';
import { newsletterService } from '../services/newsletter.service';
import { subscribeNewsletterSchema } from '../validators/newsletter.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';

export const newsletterController = {
  async subscribe(req: Request, res: Response) {
    const dto = subscribeNewsletterSchema.parse(req.body);
    const sub = await newsletterService.subscribe(dto.email, req.ip || 'unknown');
    sendCreated(res, sub, 'Vui lòng kiểm tra email để xác nhận đăng ký');
  },
  async confirm(req: Request, res: Response) {
    sendSuccess(
      res,
      await newsletterService.confirm(String(req.query.token || '')),
      'Xác nhận nhận tin thành công',
    );
  },
  async unsubscribe(req: Request, res: Response) {
    sendSuccess(
      res,
      await newsletterService.unsubscribe(String(req.query.token || '')),
      'Đã hủy đăng ký nhận tin',
    );
  },

  async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.page_size ?? 20);
    const result = await newsletterService.list(page, pageSize);
    sendSuccess(res, result);
  },

  async exportExcel(_req: Request, res: Response) {
    const buffer = await newsletterService.exportToExcelBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="newsletter_subscribers.xlsx"');
    res.send(buffer);
  },
};
