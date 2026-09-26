/* eslint-disable no-restricted-syntax */
import { Op, QueryTypes } from 'sequelize';
import { randomBytes } from 'crypto';
import { StoreAppointment } from '../models/StoreAppointment.model';
import { Store } from '../models/Store.model';
import { User } from '../models/User.model';
import { WorkShift } from '../models/WorkShift.model';
import { AppError } from '../utils/AppError';
import { AuthUserPayload } from '../types/express';
import { CreateAppointmentDto, UpdateAppointmentDto } from '../validators/appointment.validator';
import { todayDateStringVietnam } from '../utils/vietnamTime';
import { emailService } from './email.service';
import { sequelize } from '../config/database';

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
      manage_token: randomBytes(24).toString('hex'),
    });
    await appointment.update({
      code: `LHEN-${dto.appointment_date.replace(/-/g, '').slice(2)}-${String(appointment.id).padStart(5, '0')}`,
    });
    const staffEmail = shift?.user_id ? (await User.findByPk(shift.user_id))?.email : store.email;
    const variables = {
      customer_name: dto.customer_name,
      phone: dto.phone,
      store_name: store.name,
    };
    await Promise.all([
      emailService.enqueue(
        dto.email,
        'appointment_confirmed',
        variables,
        `appointment:${appointment.id}:customer`,
      ),
      emailService.enqueue(
        staffEmail,
        'appointment_new_staff',
        variables,
        `appointment:${appointment.id}:staff`,
      ),
    ]);
    return appointment;
  },

  async slots(storeId: number, date: string) {
    if (date < todayDateStringVietnam()) throw AppError.badRequest('Ngày hẹn đã qua');
    const store = await Store.findByPk(storeId);
    if (!store || store.status !== 'active') throw AppError.notFound('Không tìm thấy cửa hàng');
    const rows = await sequelize.query<{ appointment_time: string; count: number }>(
      'SELECT appointment_time,COUNT(*) count FROM store_appointments WHERE store_id=:storeId AND appointment_date=:date AND status<>"huy" GROUP BY appointment_time',
      { replacements: { storeId, date }, type: QueryTypes.SELECT },
    );
    const used = new Map(
      rows.map((row) => [String(row.appointment_time).slice(0, 5), Number(row.count)]),
    );
    const result: string[] = [];
    for (let hour = 8; hour < 17; hour += 1)
      for (const minute of [0, 30]) {
        const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        if ((used.get(value) || 0) < 3) result.push(value);
      }
    return result;
  },
  async cancel(token: string) {
    const item = await StoreAppointment.findOne({ where: { manage_token: token } });
    if (!item) throw AppError.notFound('Liên kết không hợp lệ');
    if (item.status === 'hoan_thanh') throw AppError.conflict('Lịch đã hoàn thành');
    await item.update({ status: 'huy', cancelled_at: new Date() });
    return { code: item.code, status: item.status };
  },
  async manage(token: string) {
    const item = await StoreAppointment.findOne({
      where: { manage_token: token },
      attributes: ['code', 'store_id', 'appointment_date', 'appointment_time', 'status'],
      include: [{ model: Store, as: 'store', attributes: ['id', 'name', 'address'] }],
    });
    if (!item) throw AppError.notFound('Liên kết không hợp lệ');
    return item;
  },
  async reschedule(token: string, date: string, time: string) {
    const item = await StoreAppointment.findOne({ where: { manage_token: token } });
    if (!item || item.status === 'huy' || item.status === 'hoan_thanh')
      throw AppError.conflict('Không thể đổi lịch này');
    const available = await this.slots(item.store_id, date);
    if (!available.includes(time.slice(0, 5))) throw AppError.conflict('Khung giờ không còn trống');
    await item.update({ appointment_date: date, appointment_time: time, status: 'moi' });
    return item;
  },
  async ics(token: string) {
    const item = await StoreAppointment.findOne({
      where: { manage_token: token },
      include: [{ model: Store, as: 'store' }],
    });
    if (!item) throw AppError.notFound('Liên kết không hợp lệ');
    const start = `${item.appointment_date.replace(/-/g, '')}T${item.appointment_time.replace(/:/g, '').slice(0, 6)}`;
    return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MobiFone Son La//Appointment//VI\r\nBEGIN:VEVENT\r\nUID:${item.code}@mobifone-sonla.vn\r\nDTSTART;TZID=Asia/Ho_Chi_Minh:${start}\r\nDURATION:PT30M\r\nSUMMARY:Lich hen MobiFone Son La\r\nLOCATION:${String(item.store?.address || '').replace(/[\r\n,]/g, ' ')}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
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
