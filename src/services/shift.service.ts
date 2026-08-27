import { Op } from 'sequelize';
import { WorkShift } from '../models/WorkShift.model';
import { User } from '../models/User.model';
import { Setting } from '../models/Setting.model';
import { AppError } from '../utils/AppError';
import { CreateShiftDto, UpdateShiftDto } from '../validators/shift.validator';
import { todayDateStringVietnam, currentTimeStringVietnam } from '../utils/vietnamTime';

/**
 * Kiem tra overlap: 2 ca truc cua 2 giao dich vien KHAC NHAU trong CUNG 1
 * shift_date khong duoc trung khung gio (muc 5.17). Dieu kien overlap chuan:
 * existing.start_time < new.end_time  AND  existing.end_time > new.start_time
 */
async function assertNoOverlap(
  shiftDate: Date | string,
  startTime: string,
  endTime: string,
  excludeShiftId?: number,
  excludeUserId?: number,
): Promise<void> {
  const where: Record<string, unknown> = {
    shift_date: shiftDate,
    start_time: { [Op.lt]: endTime },
    end_time: { [Op.gt]: startTime },
  };
  if (excludeShiftId) {
    where.id = { [Op.ne]: excludeShiftId };
  }
  if (excludeUserId) {
    // Chi can chan trung giua 2 nguoi KHAC nhau - cung 1 nguoi tu sua ca cua chinh minh
    // (excludeShiftId da xu ly) khong bi tinh la overlap voi chinh no.
    where.user_id = { [Op.ne]: excludeUserId };
  }

  const conflict = await WorkShift.findOne({ where });
  if (conflict) {
    throw AppError.badRequest(
      `Trung lich truc voi ca da co (user_id=${conflict.user_id}, ${conflict.start_time}-${conflict.end_time})`,
    );
  }
}

export const shiftService = {
  async list() {
    return WorkShift.findAll({
      include: [{ model: User, as: 'staff' }],
      order: [
        ['shift_date', 'DESC'],
        ['start_time', 'ASC'],
      ],
    });
  },

  async getMySchedule(userId: number) {
    return WorkShift.findAll({
      where: { user_id: userId },
      order: [['shift_date', 'DESC']],
    });
  },

  async create(dto: CreateShiftDto, createdBy: number) {
    const staff = await User.findByPk(dto.user_id);
    if (!staff) throw AppError.badRequest('Khong tim thay nhan vien');
    if (staff.role !== 'giao_dich_vien') {
      throw AppError.badRequest('Chi duoc xep lich truc cho nhan vien co vai tro giao_dich_vien');
    }

    await assertNoOverlap(dto.shift_date, dto.start_time, dto.end_time);

    return WorkShift.create({
      user_id: dto.user_id,
      shift_date: dto.shift_date as any,
      start_time: dto.start_time,
      end_time: dto.end_time,
      note: dto.note ?? null,
      created_by: createdBy,
    });
  },

  async update(id: number, dto: UpdateShiftDto) {
    const shift = await WorkShift.findByPk(id);
    if (!shift) throw AppError.notFound('Khong tim thay lich truc');

    const newDate = dto.shift_date ?? shift.shift_date;
    const newStart = dto.start_time ?? shift.start_time;
    const newEnd = dto.end_time ?? shift.end_time;

    await assertNoOverlap(newDate, newStart, newEnd, id, shift.user_id);

    await shift.update(dto as any);
    return shift;
  },

  async remove(id: number) {
    const shift = await WorkShift.findByPk(id);
    if (!shift) throw AppError.notFound('Khong tim thay lich truc');
    await shift.destroy();
  },

  /**
   * Logic hotline dong theo ca truc (muc 9, GET /api/public/current-duty-staff).
   * Bat buoc dung timezone Asia/Ho_Chi_Minh khi so sanh gio.
   */
  async getCurrentDutyStaff(): Promise<{ name: string; phone: string }> {
    const today = todayDateStringVietnam();
    const nowTime = currentTimeStringVietnam();

    const shift = await WorkShift.findOne({
      where: {
        shift_date: today,
        start_time: { [Op.lte]: nowTime },
        end_time: { [Op.gte]: nowTime },
      },
      include: [{ model: User, as: 'staff' }],
    });

    if (shift && (shift as any).staff) {
      const staff = (shift as any).staff as User;
      return { name: staff.full_name, phone: staff.phone };
    }

    const hotlineSetting = await Setting.findOne({ where: { key: 'hotline' } });
    return { name: 'Hotline MobiFone Son La', phone: hotlineSetting?.value ?? '' };
  },
};
