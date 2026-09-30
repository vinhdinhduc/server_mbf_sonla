import { Op } from 'sequelize';
import { Setting, PUBLIC_SETTING_KEYS } from '../models/Setting.model';
import { AppError } from '../utils/AppError';
import { FORBIDDEN_SETTING_KEYS, UpdateSettingsDto } from '../validators/setting.validator';

export const settingService = {
  /** GET /api/public/settings - CHI tra cac setting KHONG nhay cam (muc 6.2) */
  async listPublic() {
    const rows = await Setting.findAll({ where: { key: PUBLIC_SETTING_KEYS as any } });
    const result: Record<string, string> = {};
    rows.forEach((row) => {
      result[row.key] = row.value;
    });
    return result;
  },

  /** GET /api/admin/settings - chi admin */
  async listAdmin() {
    return Setting.findAll({
      where: { key: { [Op.notLike]: '%encrypted%' } },
      order: [
        ['group', 'ASC'],
        ['key', 'ASC'],
      ],
    });
  },

  /** Doc 1 gia tri setting bat ky theo key (dung noi bo, vd notify_email, ai_system_prompt) */
  async getRawValue(key: string): Promise<string | null> {
    const row = await Setting.findOne({ where: { key } });
    return row?.value ?? null;
  },

  /**
   * PUT /api/admin/settings - cap nhat theo group. Cac khoa bi mat
   * (ANTHROPIC_API_KEY, RECAPTCHA_SECRET_KEY, SMTP_USER, SMTP_PASS...)
   * TUYET DOI khong duoc phep ghi vao bang settings (muc 5.17 / muc 17).
   */
  async updateByGroup(dto: UpdateSettingsDto, updatedBy: number) {
    const forbidden = dto.items.find(
      (item) => FORBIDDEN_SETTING_KEYS.includes(item.key) || /encrypted/i.test(item.key),
    );
    if (forbidden) {
      throw AppError.badRequest(
        `Khóa "${forbidden.key}" là bí mật, không được phép lưu vào bảng settings - chỉ được cấu hình qua .env`,
      );
    }

    await Promise.all(
      dto.items.map((item) =>
        Setting.upsert({
          key: item.key,
          value: item.value,
          group: dto.group,
          updated_by: updatedBy,
        }),
      ),
    );

    return Setting.findAll({ where: { group: dto.group, key: { [Op.notLike]: '%encrypted%' } } });
  },
};
