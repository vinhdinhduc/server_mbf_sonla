import { Request, Response } from 'express';
import { registrationService } from '../services/registration.service';
import {
  listRegistrationQuerySchema,
  submitCartSchema,
  updateRegistrationGroupSchema,
} from '../validators/registration.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { verifyRecaptcha } from '../utils/verifyRecaptcha';

export const registrationController = {
  async submit(req: Request, res: Response) {
    const dto = submitCartSchema.parse(req.body);
    await verifyRecaptcha(dto.recaptcha_token);
    const group = await registrationService.submitCart(dto);
    sendCreated(res, group, 'Gui dang ky thanh cong, chung toi se lien he voi ban som nhat');
  },

  async list(req: Request, res: Response) {
    const query = listRegistrationQuerySchema.parse(req.query);
    const result = await registrationService.listForUser(
      req.user!,
      query.status,
      query.page,
      query.page_size,
    );
    sendSuccess(res, result);
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
    sendSuccess(res, group, 'Cap nhat trang thai thanh cong');
  },
};
