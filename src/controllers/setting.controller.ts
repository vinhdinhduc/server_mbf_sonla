import { Request, Response } from 'express';
import { settingService } from '../services/setting.service';
import { updateSettingsSchema } from '../validators/setting.validator';
import { sendSuccess } from '../utils/apiResponse';

export const settingController = {
  async listPublic(_req: Request, res: Response) {
    const result = await settingService.listPublic();
    sendSuccess(res, result);
  },

  async listAdmin(_req: Request, res: Response) {
    const rows = await settingService.listAdmin();
    sendSuccess(res, rows);
  },

  async update(req: Request, res: Response) {
    const dto = updateSettingsSchema.parse(req.body);
    const rows = await settingService.updateByGroup(dto, req.user!.id);
    req.auditContext = {
      module: 'settings',
      action: 'update',
      description: `Cap nhat settings nhom ${dto.group}`,
      newValue: dto,
    };
    sendSuccess(res, rows, 'Cap nhat cau hinh thanh cong');
  },
};
