import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { appointmentService } from '../services/appointment.service';
import {
  createAppointmentSchema,
  appointmentTokenSchema,
  rescheduleAppointmentSchema,
  updateAppointmentSchema,
} from '../validators/appointment.validator';

export const appointmentController = {
  async create(req: Request, res: Response) {
    const dto = createAppointmentSchema.parse(req.body);
    const appointment = await appointmentService.create(dto);
    sendCreated(res, appointment, 'Đặt lịch đến cửa hàng thành công');
  },

  async list(req: Request, res: Response) {
    const rows = await appointmentService.list(req.user!);
    sendSuccess(res, rows);
  },
  async slots(req: Request, res: Response) {
    sendSuccess(
      res,
      await appointmentService.slots(Number(req.query.store_id), String(req.query.date || '')),
    );
  },
  async cancel(req: Request, res: Response) {
    const token = appointmentTokenSchema.parse(req.body.token);
    sendSuccess(res, await appointmentService.cancel(token));
  },
  async manage(req: Request, res: Response) {
    const token = appointmentTokenSchema.parse(req.query.token);
    sendSuccess(res, await appointmentService.manage(token));
  },
  async reschedule(req: Request, res: Response) {
    const dto = rescheduleAppointmentSchema.parse(req.body);
    sendSuccess(res, await appointmentService.reschedule(dto.token, dto.date, dto.time));
  },
  async ics(req: Request, res: Response) {
    const token = appointmentTokenSchema.parse(req.query.token);
    const data = await appointmentService.ics(token);
    res
      .type('text/calendar')
      .setHeader('Content-Disposition', 'attachment; filename="lich-hen.ics"');
    res.send(data);
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
    sendSuccess(res, appointment, 'Cập nhật lịch hẹn thành công');
  },
};
