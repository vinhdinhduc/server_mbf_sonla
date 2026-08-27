import { Request, Response } from 'express';
import { contactService } from '../services/contact.service';
import { createContactSchema, updateContactSchema } from '../validators/contact.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { verifyRecaptcha } from '../utils/verifyRecaptcha';

export const contactController = {
  async create(req: Request, res: Response) {
    const dto = createContactSchema.parse(req.body);
    await verifyRecaptcha(dto.recaptcha_token);
    const { recaptcha_token, ...rest } = dto;
    const contact = await contactService.create(rest);
    sendCreated(res, contact, 'Gui lien he thanh cong');
  },

  async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.page_size ?? 20);
    const status = req.query.status as string | undefined;
    const result = await contactService.list(status, page, pageSize);
    sendSuccess(res, result);
  },

  async updateStatus(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateContactSchema.parse(req.body);
    const contact = await contactService.updateStatus(id, dto);
    req.auditContext = { module: 'contacts', action: 'update', targetId: id, newValue: dto };
    sendSuccess(res, contact, 'Cap nhat trang thai thanh cong');
  },
};
