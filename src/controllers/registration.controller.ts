import { Request, Response } from 'express';
import { registrationService } from '../services/registration.service';
import {
  listRegistrationQuerySchema,
  submitCartSchema,
  updateRegistrationGroupSchema,
} from '../validators/registration.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { verifyRecaptcha } from '../utils/verifyRecaptcha';
import { AppError } from '../utils/AppError';
import { receiptService } from '../services/receipt.service';
import { RegistrationGroup } from '../models/RegistrationGroup.model';
import { maskPhone } from '../utils/registrationWorkflow';

export const registrationController = {
  async submit(req: Request, res: Response) {
    const dto = submitCartSchema.parse(req.body);
    await verifyRecaptcha(dto.recaptcha_token);
    const key = req.header('Idempotency-Key');
    if (key && !/^[A-Za-z0-9_-]{16,100}$/.test(key)) throw AppError.badRequest('Idempotency-Key không hợp lệ');
    const group = await registrationService.submitCart(dto, key);
    sendCreated(res, group, 'Gửi đăng ký thành công, chúng tôi sẽ liên hệ với bạn sớm nhất');
  },

  async list(req: Request, res: Response) {
    const query = listRegistrationQuerySchema.parse(req.query);
    const result = await registrationService.listForUser(
      req.user!,
      query.status,
      query.page,
      query.page_size,
      query,
    );
    sendSuccess(res, result);
  },

  async exportExcel(req: Request, res: Response) {
    const query = listRegistrationQuerySchema.parse(req.query);
    await registrationService.exportExcel(req.user!, res, query);
  },
  async counts(req: Request, res: Response) { sendSuccess(res, await registrationService.counts(req.user!)); },

  async getById(req: Request, res: Response) {
    sendSuccess(res, await registrationService.getById(Number(req.params.id), req.user!));
  },

  async lookup(req: Request, res: Response) {
    const code = String(req.body.code || '');
    const phone = String(req.body.phone || '');
    if (!/^DK-[0-9]{6}-[0-9]{4,6}$/.test(code) || !/^[0-9+]{9,20}$/.test(phone)) throw AppError.badRequest('Mã hoặc số điện thoại không hợp lệ');
    const group = await RegistrationGroup.findOne({ where: { code, phone } });
    if (!group) throw AppError.notFound('Không tìm thấy đăng ký với mã và số điện thoại này');
    sendSuccess(res, { code: group.code, customer_name: group.customer_name, phone: maskPhone(group.phone), status: group.status, created_at: group.created_at, total_amount: group.total_amount });
  },

  async receiptPublic(req: Request, res: Response) {
    const code = String(req.body.code || ''); const phone = String(req.body.phone || '');
    const group = await RegistrationGroup.findOne({ where: { code, phone } });
    if (!group) throw AppError.notFound('Không tìm thấy đăng ký');
    const receipt = await receiptService.build(group.id, undefined, phone);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.number}.pdf"`);
    res.send(receipt.buffer);
  },

  async receiptAdmin(req: Request, res: Response) {
    const receipt = await receiptService.build(Number(req.params.id), req.user!);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.number}.pdf"`);
    res.send(receipt.buffer);
  },

  async updateStatus(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateRegistrationGroupSchema.parse(req.body);
    const group = await registrationService.updateStatus(id, dto, req.user!);
    req.auditContext = {
      module: 'registration_groups',
      action: 'update',
      targetId: id,
      newValue: dto,
    };
    sendSuccess(res, group, 'Cập nhật trạng thái thành công');
  },
};
