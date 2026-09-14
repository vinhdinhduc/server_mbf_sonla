import { Op } from 'sequelize';
import { StoreAppointment } from '../models/StoreAppointment.model';
import { Store } from '../models/Store.model';
import { User } from '../models/User.model';
import { WorkShift } from '../models/WorkShift.model';
import { AppError } from '../utils/AppError';
import { AuthUserPayload } from '../types/express';
import { CreateAppointmentDto, UpdateAppointmentDto } from '../validators/appointment.validator';
import { todayDateStringVietnam } from '../utils/vietnamTime';

export const appointmentService = {
  async create(dto: CreateAppointmentDto) {
    if (dto.appointment_date < todayDateStringVietnam()) {
      throw AppError.badRequest('Khong the dat lich vao ngay da qua');
    }
    const store = await Store.findByPk(dto.store_id);
    if (!store) throw AppError.badRequest('Khong tim thay cua hang');

    const shift = await WorkShift.findOne({
      where: {
        store_id: dto.store_id,
        shift_date: dto.appointment_date,
        start_time: { [Op.lte]: dto.appointment_time },
        end_time: { [Op.gte]: dto.appointment_time },
      },
      order: [['start_time', 'ASC']],
    });

    return StoreAppointment.create({
      ...dto,
      note: dto.note ?? null,
      assigned_to: shift?.user_id ?? null,
    });
  },

  async list(currentUser: AuthUserPayload) {
    const where: Record<string, unknown> = {};
    if (currentUser.role === 'giao_dich_vien') where.assigned_to = currentUser.id;

    return StoreAppointment.findAll({
      where,
      include: [
        { model: Store, as: 'store' },
        { model: User, as: 'assignee' },
      ],
      order: [
        ['appointment_date', 'ASC'],
        ['appointment_time', 'ASC'],
        ['created_at', 'DESC'],
      ],
    });
  },

  async updateStatus(id: number, dto: UpdateAppointmentDto, currentUser: AuthUserPayload) {
    const appointment = await StoreAppointment.findByPk(id);
    if (!appointment) throw AppError.notFound('Khong tim thay lich hen');
    if (currentUser.role === 'giao_dich_vien' && appointment.assigned_to !== currentUser.id) {
      throw AppError.forbidden('Ban khong duoc phep cap nhat lich hen nay');
    }
    await appointment.update(dto);
    return appointment;
  },
};
