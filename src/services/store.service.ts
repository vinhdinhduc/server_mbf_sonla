import { Op, QueryTypes } from 'sequelize';
import { Store } from '../models/Store.model';
import { sequelize } from '../config/database';
import { AppError } from '../utils/AppError';
import { CreateStoreDto, UpdateStoreDto } from '../validators/store.validator';
import { isStoreOpenNow, parseOpeningSlots } from '../utils/storeHours';
import { User } from '../models/User.model';
import { WorkShift } from '../models/WorkShift.model';
import { buildImageUrl } from '../utils/buildImageUrl';
import { currentTimeStringVietnam, todayDateStringVietnam } from '../utils/vietnamTime';

export const storeService = {
  async listWards() {
    return sequelize.query<{ code: string; name_with_type: string }>(
      "SELECT code, name_with_type FROM wards WHERE province_code = '14' ORDER BY name_with_type",
      { type: QueryTypes.SELECT },
    );
  },

  async listPublic(wardCode: string | undefined) {
    const where: Record<string, unknown> = { status: 'active' };
    if (wardCode) where.ward_code = wardCode;
    const rows = await Store.findAll({ where, order: [['id', 'ASC']] });
    const storeIds = rows.map((store) => store.id);
    const staff = storeIds.length
      ? await User.findAll({
          where: {
            store_id: { [Op.in]: storeIds },
            role: 'giao_dich_vien',
            status: 'active',
            is_public_profile: true,
            public_phone: { [Op.ne]: null },
          },
          attributes: [
            'id',
            'store_id',
            'full_name',
            'job_title',
            'avatar_url',
            'public_phone',
            'public_zalo',
          ],
        })
      : [];
    const staffIds = staff.map((member) => member.id);
    const shifts = staffIds.length
      ? await WorkShift.findAll({
          where: {
            user_id: { [Op.in]: staffIds },
            shift_date: todayDateStringVietnam(),
            start_time: { [Op.lte]: currentTimeStringVietnam() },
            end_time: { [Op.gt]: currentTimeStringVietnam() },
          },
          attributes: ['user_id', 'store_id'],
        })
      : [];
    const onDuty = new Set(shifts.map((shift) => `${shift.store_id}:${shift.user_id}`));
    return rows.map((store) => {
      const slots = parseOpeningSlots(store.opening_hours_json);
      return {
        ...store.toJSON(),
        opening_hours_json: slots,
        open_now: slots ? isStoreOpenNow(slots) : null,
        staff: staff
          .filter((member) => member.store_id === store.id)
          .map((member) => ({
            id: member.id,
            full_name: member.full_name,
            job_title: member.job_title,
            avatar_url: buildImageUrl(member.avatar_url),
            public_phone: member.public_phone,
            public_zalo: member.public_zalo,
            on_duty: onDuty.has(`${store.id}:${member.id}`),
          })),
      };
    });
  },

  async listAdmin() {
    const rows = await Store.findAll({ order: [['id', 'ASC']] });
    const storeIds = rows.map((store) => store.id);
    const staff = storeIds.length
      ? await User.findAll({
          where: { store_id: { [Op.in]: storeIds }, role: 'giao_dich_vien', status: 'active' },
          attributes: ['id', 'store_id', 'full_name', 'avatar_url'],
        })
      : [];
    return rows.map((store) => ({
      ...store.toJSON(),
      opening_hours_json: parseOpeningSlots(store.opening_hours_json),
      staff_count: staff.filter((member) => member.store_id === store.id).length,
    }));
  },

  async getById(id: number) {
    const store = await Store.findByPk(id);
    if (!store) throw AppError.notFound('Không tìm thấy cửa hàng');
    return store;
  },

  async create(dto: CreateStoreDto) {
    const ward = await getWard(dto.ward_code);
    const fullAddress = `${dto.street_address}, ${ward.name_with_type}, Tỉnh Sơn La`;
    return Store.create({
      ...dto,
      address: fullAddress,
      district: '',
      province_code: '14',
      full_address: fullAddress,
      opening_hours: displayHours(dto.opening_hours_json),
      needs_review: false,
    });
  },

  async update(id: number, dto: UpdateStoreDto) {
    const store = await this.getById(id);
    const street = dto.street_address ?? store.street_address;
    const wardCode = dto.ward_code ?? store.ward_code;
    let addressFields = {};
    if (street && wardCode && (dto.street_address || dto.ward_code)) {
      const ward = await getWard(wardCode);
      const fullAddress = `${street}, ${ward.name_with_type}, Tỉnh Sơn La`;
      addressFields = {
        address: fullAddress,
        full_address: fullAddress,
        province_code: '14',
        needs_review: false,
      };
    }
    await store.update({
      ...dto,
      ...addressFields,
      ...(dto.opening_hours_json ? { opening_hours: displayHours(dto.opening_hours_json) } : {}),
    });
    return store;
  },

  async remove(id: number) {
    const store = await this.getById(id);
    await store.update({ status: 'inactive' });
  },
};

async function getWard(code: string) {
  const rows = await sequelize.query<{ code: string; name_with_type: string }>(
    "SELECT code, name_with_type FROM wards WHERE code = ? AND province_code = '14' LIMIT 1",
    { replacements: [code], type: QueryTypes.SELECT },
  );
  if (!rows[0]) throw AppError.badRequest('Xã/phường không thuộc tỉnh Sơn La');
  return rows[0];
}

export function displayHours(slots: Array<{ days: number[]; open: string; close: string }>) {
  return slots
    .map((slot) => {
      const days = [...slot.days].sort((a, b) => a - b);
      const label = (day: number) => (day === 7 ? 'CN' : `T${day + 1}`);
      const consecutive = days.every((day, index) => index === 0 || day === days[index - 1] + 1);
      const displayDays =
        consecutive && days.length > 1
          ? `${label(days[0])} – ${label(days[days.length - 1])}`
          : days.map(label).join(', ');
      return `${slot.open} – ${slot.close} (${displayDays})`;
    })
    .join('; ');
}
