import { sequelize } from '../config/database';
import { RegistrationGroup } from '../models/RegistrationGroup.model';
import { RegistrationItem, RegistrationItemType } from '../models/RegistrationItem.model';
import { SimNumber } from '../models/SimNumber.model';
import { Package } from '../models/Package.model';
import { Solution } from '../models/Solution.model';
import { AppError } from '../utils/AppError';
import { AuthUserPayload } from '../types/express';
import { SubmitCartDto, UpdateRegistrationGroupDto } from '../validators/registration.validator';
import { activeNotifier } from '../config/notifier';
import { settingService } from './setting.service';

interface ResolvedItem {
  type: RegistrationItemType;
  reference_id: number;
  reference_label: string;
  price_snapshot: number | null;
}

async function resolveItemSnapshot(
  type: RegistrationItemType,
  referenceId: number,
): Promise<ResolvedItem> {
  if (type === 'sim') {
    const sim = await SimNumber.findByPk(referenceId);
    if (!sim) throw AppError.badRequest(`Khong tim thay sim id=${referenceId}`);
    return {
      type,
      reference_id: referenceId,
      reference_label: sim.phone_number,
      price_snapshot: Number(sim.price),
    };
  }
  if (type === 'goi_cuoc') {
    const pkg = await Package.findByPk(referenceId);
    if (!pkg) throw AppError.badRequest(`Khong tim thay goi cuoc id=${referenceId}`);
    return {
      type,
      reference_id: referenceId,
      reference_label: pkg.name,
      price_snapshot: Number(pkg.price),
    };
  }
  const sol = await Solution.findByPk(referenceId);
  if (!sol) throw AppError.badRequest(`Khong tim thay giai phap id=${referenceId}`);
  return {
    type,
    reference_id: referenceId,
    reference_label: sol.name,
    price_snapshot: null,
  };
}

export const registrationService = {
  /**
   * Tao 1 registration_groups + n registration_items trong CUNG 1 transaction
   * Sequelize (muc 5.17, 6.2). Gio hang khong co bang rieng - toan bo danh sach
   * san pham nhan tu 1 request duy nhat cua client.
   */
  async submitCart(dto: SubmitCartDto) {
    const resolvedItems = await Promise.all(
      dto.items.map((item) => resolveItemSnapshot(item.type, item.reference_id)),
    );

    const group = await sequelize.transaction(async (t) => {
      const createdGroup = await RegistrationGroup.create(
        {
          customer_name: dto.customer_name,
          phone: dto.phone,
          province: dto.province,
          district: dto.district,
          ward: dto.ward,
          delivery_address: dto.delivery_address,
          note: dto.note ?? null,
        },
        { transaction: t },
      );

      await RegistrationItem.bulkCreate(
        resolvedItems.map((item) => ({
          registration_group_id: createdGroup.id,
          type: item.type,
          reference_id: item.reference_id,
          reference_label: item.reference_label,
          price_snapshot: item.price_snapshot,
        })),
        { transaction: t },
      );

      return createdGroup;
    });

    // Sau khi luu thanh cong: gui email tu dong toi setting notify_email
    const notifyEmail = await settingService.getRawValue('notify_email');
    if (notifyEmail) {
      await activeNotifier
        .send(notifyEmail, 'new_registration', {
          customer_name: dto.customer_name,
          phone: dto.phone,
          note: dto.note,
          item_count: resolvedItems.length,
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('Gui email thong bao dang ky that bai:', err);
        });
    }

    return RegistrationGroup.findByPk(group.id, {
      include: [{ association: 'items' }],
    });
  },

  async listForUser(
    currentUser: AuthUserPayload,
    status: string | undefined,
    page: number,
    pageSize: number,
  ) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    // nhan_vien: CHI xem cac muc duoc giao (assigned_to = chinh minh)
    // admin/chuyen_vien/giao_dich_vien: xem TOAN BO (muc 4)
    if (currentUser.role === 'nhan_vien') {
      where.assigned_to = currentUser.id;
    }

    const { rows, count } = await RegistrationGroup.findAndCountAll({
      where,
      include: [{ association: 'items' }],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return { items: rows, total: count, page, page_size: pageSize };
  },

  async updateStatus(id: number, dto: UpdateRegistrationGroupDto, currentUser: AuthUserPayload) {
    const group = await RegistrationGroup.findByPk(id);
    if (!group) throw AppError.notFound('Khong tim thay yeu cau dang ky');

    // LOGIC NGHIEP VU nam o Service (khong o Controller): nhan_vien chi duoc
    // sua khi assigned_to === currentUser.id (muc 16.1)
    if (currentUser.role === 'nhan_vien' && group.assigned_to !== currentUser.id) {
      throw AppError.forbidden('Ban khong duoc phep cap nhat yeu cau dang ky nay');
    }

    await group.update(dto);
    return group;
  },
};
