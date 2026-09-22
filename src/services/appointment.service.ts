import { Op } from 'sequelize';
import { StoreAppointment } from '../models/StoreAppointment.model';
import { Store } from '../models/Store.model';
import { User } from '../models/User.model';
import { WorkShift } from '../models/WorkShift.model';
import { AppError } from '../utils/AppError';
import { AuthUserPayload } from '../types/express';
import { CreateAppointmentDto, UpdateAppointmentDto } from '../validators/appointment.validator';
import { todayDateStringVietnam } from '../utils/vietnamTime';
import { emailService } from './email.service';

export const appointmentService = {
  async create(dto: CreateAppointmentDto) {
    if (dto.appointment_date < todayDateStringVietnam()) {
      throw AppError.badRequest('Không thể đặt lịch vào ngày đã qua');
    }
    const store = await Store.findByPk(dto.store_id);
    if (!store) throw AppError.badRequest('Không tìm thấy cửa hàng');

    const shift = await WorkShift.findOne({
      where: {
        store_id: dto.store_id,
        shift_date: dto.appointment_date,
        start_time: { [Op.lte]: dto.appointment_time },
        end_time: { [Op.gte]: dto.appointment_time },
      },
      order: [['start_time', 'ASC']],
    });

    const appointment = await StoreAppointment.create({
      ...dto,
      email: dto.email || null,
      note: dto.note ?? null,
      assigned_to: shift?.user_id ?? null,
    });
    const staffEmail = shift?.user_id ? (await User.findByPk(shift.user_id))?.email : store.email;
    const variables = { customer_name: dto.customer_name, phone: dto.phone, store_name: store.name };
    await Promise.all([
      emailService.enqueue(dto.email, 'appointment_confirmed', variables, `appointment:${appointment.id}:customer`),
      emailService.enqueue(staffEmail, 'appointment_new_staff', variables, `appointment:${appointment.id}:staff`),
    ]);
    return appointment;
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
    if (!appointment) throw AppError.notFound('Không tìm thấy lịch hẹn');
    if (currentUser.role === 'giao_dich_vien' && appointment.assigned_to !== currentUser.id) {
      throw AppError.forbidden('Bạn không được phép cập nhật lịch hẹn này');
    }
    await appointment.update(dto);
    return appointment;
  },
};
