import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { appointmentService } from '../services/appointment.service';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
} from '../validators/appointment.validator';

export const appointmentController = {
  async create(req: Request, res: Response) {
    const dto = createAppointmentSchema.parse(req.body);
    const appointment = await appointmentService.create(dto);
    sendCreated(res, appointment, 'Dat lich den cua hang thanh cong');
  },

  async list(req: Request, res: Response) {
    const rows = await appointmentService.list(req.user!);
    sendSuccess(res, rows);
  },

  async updateStatus(req: Request, res: Response) {
    const dto = updateAppointmentSchema.parse(req.body);
    const appointment = await appointmentService.updateStatus(
      Number(req.params.id),
      dto,
      req.user!,
    );
    req.auditContext = {
      module: 'store_appointments',
      action: 'update',
      targetId: appointment.id,
      newValue: dto,
    };
    sendSuccess(res, appointment, 'Cap nhat lich hen thanh cong');
  },
};
