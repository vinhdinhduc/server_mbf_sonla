import { Request, Response } from 'express';
import { shiftService } from '../services/shift.service';
import { createShiftSchema, updateShiftSchema } from '../validators/shift.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';

export const shiftController = {
  async list(_req: Request, res: Response) {
    const rows = await shiftService.list();
    sendSuccess(res, rows);
  },

  async mySchedule(req: Request, res: Response) {
    const rows = await shiftService.getMySchedule(req.user!.id);
    sendSuccess(res, rows);
  },

  async create(req: Request, res: Response) {
    const dto = createShiftSchema.parse(req.body);
    const shift = await shiftService.create(dto, req.user!.id);
    req.auditContext = { module: 'shifts', action: 'create', targetId: shift.id, newValue: dto };
    sendCreated(res, shift, 'Xếp lịch trực thành công');
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateShiftSchema.parse(req.body);
    const shift = await shiftService.update(id, dto);
    req.auditContext = { module: 'shifts', action: 'update', targetId: id, newValue: dto };
    sendSuccess(res, shift, 'Cập nhật lịch trực thành công');
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    await shiftService.remove(id);
    req.auditContext = { module: 'shifts', action: 'delete', targetId: id };
    sendSuccess(res, null, 'Xóa lịch trực thành công');
  },

  async currentDutyStaff(_req: Request, res: Response) {
    const result = await shiftService.getCurrentDutyStaff();
    sendSuccess(res, result);
  },
};
