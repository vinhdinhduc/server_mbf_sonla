import { Op, QueryTypes, UniqueConstraintError } from 'sequelize';
import { sequelize } from '../config/database';
import { RegistrationGroup } from '../models/RegistrationGroup.model';
import { RegistrationItem, RegistrationItemType } from '../models/RegistrationItem.model';
import { SimNumber } from '../models/SimNumber.model';
import { Package } from '../models/Package.model';
import { Solution } from '../models/Solution.model';
import { SolutionPricing } from '../models/SolutionPricing.model';
import { AppError } from '../utils/AppError';
import { AuthUserPayload } from '../types/express';
import { SubmitCartDto, UpdateRegistrationGroupDto } from '../validators/registration.validator';
import { settingService } from './setting.service';
import { emailService } from './email.service';
import { Store } from '../models/Store.model';
import { User } from '../models/User.model';
import { allocateNumber, assertTransition } from '../utils/registrationWorkflow';
import { maskPhone } from '../utils/registrationWorkflow';
import ExcelJS from 'exceljs';
import { Response } from 'express';

interface ResolvedItem {
  type: RegistrationItemType;
  reference_id: number;
  reference_label: string;
  price_snapshot: number | null;
  fee_snapshot: number;
}

const safeExcel = (value: unknown) => {
  const text = String(value ?? '');
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
};
function sameSubmission(group: RegistrationGroup, dto: SubmitCartDto) {
  const items = (group.items || []).map((item) => `${item.type}:${item.reference_id}`).sort();
  const wanted = dto.items.map((item) => `${item.type}:${item.reference_id}`).sort();
  return group.phone === dto.phone && group.customer_name === dto.customer_name && group.email === dto.email && group.delivery_method === dto.delivery_method && JSON.stringify(items) === JSON.stringify(wanted);
}

async function resolveItemSnapshot(
  type: RegistrationItemType,
  referenceId: number,
): Promise<ResolvedItem> {
  if (type === 'sim') {
    const sim = await SimNumber.findByPk(referenceId);
    if (!sim) throw AppError.badRequest(`Không tìm thấy sim id=${referenceId}`);
    const fee = await settingService.getRawValue(
      `sim_activation_fee_${sim.subscription_type ?? 'postpaid'}`,
    );
    return {
      type,
      reference_id: referenceId,
      reference_label: sim.phone_number,
      price_snapshot: Number(sim.price ?? 0),
      fee_snapshot: Number(fee ?? (sim.subscription_type === 'prepaid' ? 50000 : 60000)),
    };
  }
  if (type === 'goi_cuoc') {
    const pkg = await Package.findByPk(referenceId);
    if (!pkg || pkg.status !== 'active' || pkg.deleted_at || (pkg.effective_from && new Date(pkg.effective_from) > new Date()) || (pkg.effective_to && new Date(pkg.effective_to) < new Date())) throw AppError.badRequest(`Gói cước id=${referenceId} không còn được bán`);
    return {
      type,
      reference_id: referenceId,
      reference_label: pkg.name,
      price_snapshot: Number(pkg.price),
      fee_snapshot: 0,
    };
  }
  if (type === 'solution_plan') {
    const plan = await SolutionPricing.findByPk(referenceId);
    if (!plan || plan.status !== 'active') throw AppError.badRequest(`Gói giải pháp id=${referenceId} không còn được bán`);
    const solution = await Solution.findByPk(plan.solution_id);
    if (!solution || solution.status !== 'active') throw AppError.badRequest('Giải pháp không còn hiệu lực');
    return { type, reference_id: referenceId, reference_label: `${solution.name} - ${plan.package_name}`, price_snapshot: Number(plan.price), fee_snapshot: 0 };
  }
  const sol = await Solution.findByPk(referenceId);
  if (!sol) throw AppError.badRequest(`Không tìm thấy giải pháp id=${referenceId}`);
  return {
    type,
    reference_id: referenceId,
    reference_label: sol.name,
    price_snapshot: null,
    fee_snapshot: 0,
  };
}

export const registrationService = {
  /**
   * Tao 1 registration_groups + n registration_items trong CUNG 1 transaction
   * Sequelize (muc 5.17, 6.2). Gio hang khong co bang rieng - toan bo danh sach
   * san pham nhan tu 1 request duy nhat cua client.
   */
  async submitCart(dto: SubmitCartDto, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existing = await RegistrationGroup.findOne({ where: { idempotency_key: idempotencyKey }, include: [{ association: 'items' }] });
      if (existing) {
        if (!sameSubmission(existing, dto)) throw AppError.conflict('Idempotency-Key đã được dùng cho đăng ký khác');
        return existing;
      }
    }
    const recent = await RegistrationGroup.findOne({ where: { phone: dto.phone, created_at: { [Op.gte]: new Date(Date.now() - 60_000) }, status: { [Op.ne]: 'huy' } } });
    if (recent) throw AppError.conflict('Số điện thoại vừa gửi đăng ký, vui lòng thử lại sau một phút');
    const resolvedItems = await Promise.all(
      dto.items.map((item) => resolveItemSnapshot(item.type, item.reference_id)),
    );
    const store = dto.delivery_method === 'store' ? await Store.findOne({ where: { name: dto.delivery_store!, status: 'active' } }) : null;
    if (dto.delivery_method === 'store' && !store) throw AppError.badRequest('Cửa hàng nhận không hợp lệ');
    const totalAmount = resolvedItems.reduce((sum, item) => sum + Number(item.price_snapshot || 0) + item.fee_snapshot, 0);

    let group: RegistrationGroup;
    try { group = await sequelize.transaction(async (t) => {
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: '2-digit', month: '2-digit', day: '2-digit' }).format(new Date()).replace(/-/g, '');
      const sequence = await allocateNumber(`DK-${date}`, t);
      const createdGroup = await RegistrationGroup.create(
        {
          code: `DK-${date}-${String(sequence).padStart(4, '0')}`,
          customer_name: dto.customer_name,
          phone: dto.phone,
          email: dto.email,
          delivery_method: dto.delivery_method,
          sim_type: dto.sim_type,
          delivery_store: dto.delivery_store ?? null,
          province: dto.province,
          district: '',
          ward: dto.ward,
          delivery_address: dto.delivery_address ?? '',
          note: dto.note ?? null,
          customer_type: dto.customer_type,
          store_id: store?.id ?? null,
          total_amount: totalAmount,
          source_utm: dto.source_utm ?? null,
          consent_at: new Date(),
          idempotency_key: idempotencyKey ?? null,
        },
        { transaction: t },
      );

      const uniqueSimIds = [
        ...new Set(resolvedItems.filter((item) => item.type === 'sim').map((item) => item.reference_id)),
      ];
      for (const simId of uniqueSimIds) {
        const [affected] = await SimNumber.update(
          {
            status: 'reserved',
            reserved_until: new Date(Date.now() + 30 * 60 * 1000),
            reserved_registration_id: createdGroup.id,
          },
          { where: { id: simId, status: 'available' }, transaction: t },
        );
        if (affected !== 1) {
          throw AppError.conflict('Số vừa được chọn bởi người khác, vui lòng chọn số khác');
        }
      }

      await RegistrationItem.bulkCreate(
        resolvedItems.map((item) => ({
          registration_group_id: createdGroup.id,
          type: item.type,
          reference_id: item.reference_id,
          reference_label: item.reference_label,
          price_snapshot: item.price_snapshot,
          fee_snapshot: item.fee_snapshot,
          quantity: 1,
        })),
        { transaction: t },
      );

      await sequelize.query("INSERT INTO registration_events(registration_id,from_status,to_status,actor_id,note,created_at) VALUES (:id,NULL,'moi',NULL,NULL,NOW())", { replacements: { id: createdGroup.id }, transaction: t });

      return createdGroup;
    }); } catch (error) {
      if (idempotencyKey && error instanceof UniqueConstraintError) {
        const existing = await RegistrationGroup.findOne({ where: { idempotency_key: idempotencyKey }, include: [{ association: 'items' }] });
        if (existing && sameSubmission(existing, dto)) return existing;
      }
      throw error;
    }

    const [notifyEmail, branchName, hotline] = await Promise.all([
      settingService.getRawValue('notify_email'),
      settingService.getRawValue('site_name'),
      settingService.getRawValue('hotline'),
    ]);
    const variables = { customer_name: dto.customer_name, phone: dto.phone, registration_code: group.code || '', item_count: resolvedItems.length, branch_name: branchName || '', hotline: hotline || '' };
    await Promise.all([
      emailService.enqueue(dto.email, 'registration_received_customer', variables, `registration:${group.id}:customer`),
      emailService.enqueue(notifyEmail, 'registration_new_staff', variables, `registration:${group.id}:staff`),
      emailService.enqueue(store?.email, 'registration_new_staff', variables, `registration:${group.id}:store`),
    ]);

    return RegistrationGroup.findByPk(group.id, {
      include: [{ association: 'items' }],
    });
  },

  async listForUser(
    currentUser: AuthUserPayload,
    status: string | undefined,
    page: number,
    pageSize: number,
    filters: { search?: string; store_id?: number; from?: string; to?: string } = {},
  ) {
    const where: Record<string | symbol, unknown> = {};
    if (status) where.status = status;
    if (filters.search?.trim()) where[Op.or] = [{ code: { [Op.like]: `%${filters.search.trim()}%` } }, { customer_name: { [Op.like]: `%${filters.search.trim()}%` } }, { phone: { [Op.like]: `%${filters.search.trim()}%` } }];
    if (filters.store_id) where.store_id = filters.store_id;
    if (filters.from || filters.to) where.created_at = { ...(filters.from ? { [Op.gte]: new Date(`${filters.from}T00:00:00+07:00`) } : {}), ...(filters.to ? { [Op.lte]: new Date(`${filters.to}T23:59:59+07:00`) } : {}) };

    if (currentUser.role === 'giao_dich_vien') {
      const teller = await User.findByPk(currentUser.id);
      if (!teller?.store_id) throw AppError.forbidden('Tài khoản chưa được gán cửa hàng');
      where.store_id = teller.store_id;
    }
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

  async exportExcel(currentUser: AuthUserPayload, res: Response, filters: { status?: string; search?: string; store_id?: number; from?: string; to?: string }) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="dang-ky.xlsx"');
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
    const sheet = workbook.addWorksheet('Đăng ký');
    sheet.columns = [
      { header: 'Mã', key: 'code', width: 22 }, { header: 'Khách hàng', key: 'customer', width: 30 },
      { header: 'SĐT', key: 'phone', width: 22 }, { header: 'Loại KH', key: 'customer_type', width: 16 },
      { header: 'Cửa hàng', key: 'store', width: 18 }, { header: 'Sản phẩm', key: 'items', width: 50 },
      { header: 'Tổng tiền', key: 'total', width: 18 }, { header: 'Trạng thái', key: 'status', width: 18 },
      { header: 'Ngày tạo', key: 'created', width: 24 },
    ];
    let page = 1; let count = 0;
    while (count < 100000) {
      const batch = await this.listForUser(currentUser, filters.status, page++, 1000, filters);
      for (const group of batch.items) {
        sheet.addRow({ code: safeExcel(group.code), customer: safeExcel(group.customer_name), phone: safeExcel(group.phone), customer_type: group.customer_type, store: group.store_id || '', items: safeExcel(group.items?.map((item) => item.reference_label).join(', ')), total: Number(group.total_amount), status: group.status, created: group.created_at }).commit();
        count++;
      }
      if (batch.items.length < 1000) break;
    }
    await sheet.commit();
    await workbook.commit();
  },

  async counts(currentUser: AuthUserPayload) {
    let scope = ''; const replacements: Record<string, number> = {};
    if (currentUser.role === 'giao_dich_vien') {
      const teller = await User.findByPk(currentUser.id);
      if (!teller?.store_id) throw AppError.forbidden();
      scope = ' WHERE store_id=:storeId'; replacements.storeId = teller.store_id;
    } else if (currentUser.role === 'nhan_vien') { scope = ' WHERE assigned_to=:userId'; replacements.userId = currentUser.id; }
    const rows = await sequelize.query<{ status: string; count: number }>(`SELECT status,COUNT(*) AS count FROM registration_groups${scope} GROUP BY status`, { type: QueryTypes.SELECT, replacements });
    const result = { all: 0, moi: 0, dang_xu_ly: 0, hoan_thanh: 0, huy: 0 };
    for (const row of rows) { const count = Number(row.count); if (row.status in result) result[row.status as keyof typeof result] = count; result.all += count; }
    return result;
  },

  async getById(id: number, currentUser: AuthUserPayload) {
    const group = await RegistrationGroup.findByPk(id, { include: [{ association: 'items' }] });
    if (!group) throw AppError.notFound('Không tìm thấy đăng ký');
    if (currentUser.role === 'nhan_vien' && group.assigned_to !== currentUser.id) throw AppError.forbidden();
    if (currentUser.role === 'giao_dich_vien') {
      const teller = await User.findByPk(currentUser.id);
      if (!teller?.store_id || group.store_id !== teller.store_id) throw AppError.forbidden();
    }
    const events = await sequelize.query('SELECT from_status,to_status,actor_id,note,created_at FROM registration_events WHERE registration_id=:id ORDER BY id', { replacements: { id }, type: QueryTypes.SELECT });
    return { ...group.toJSON(), events };
  },

  async updateStatus(id: number, dto: UpdateRegistrationGroupDto, currentUser: AuthUserPayload) {
    await this.getById(id, currentUser);
    await sequelize.transaction(async (transaction) => {
      const group = await RegistrationGroup.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!group) throw AppError.notFound('Không tìm thấy đăng ký');
      if (dto.store_id != null) {
        const store = await Store.findByPk(dto.store_id, { transaction });
        if (!store || store.status !== 'active') throw AppError.badRequest('Cửa hàng không hợp lệ');
      }
      if (dto.assigned_to != null) {
        const assignee = await User.findByPk(dto.assigned_to, { transaction });
        if (!assignee || assignee.status !== 'active' || ((dto.store_id || group.store_id) && assignee.store_id !== (dto.store_id || group.store_id))) throw AppError.badRequest('Người xử lý không thuộc cửa hàng');
      }
      const previous = group.status;
      if (dto.status) assertTransition(previous, dto.status, currentUser.role, dto.note);
      if (dto.status && dto.status !== previous) {
        const items = await RegistrationItem.findAll({ where: { registration_group_id: id, type: 'sim' }, transaction });
        for (const item of items) {
          const sim = await SimNumber.findByPk(item.reference_id, { transaction, lock: transaction.LOCK.UPDATE });
          if (dto.status === 'hoan_thanh') {
            if (!sim || sim.reserved_registration_id !== id || !['reserved', 'sold'].includes(sim.status)) throw AppError.conflict('SIM không còn được giữ cho đăng ký này');
            if (sim.status === 'reserved') await sim.update({ status: 'sold', reserved_until: null }, { transaction });
          } else if (dto.status === 'huy') {
            if (sim?.reserved_registration_id === id && ['reserved', 'sold'].includes(sim.status)) await sim.update({ status: 'available', reserved_until: null, reserved_registration_id: null }, { transaction });
          }
        }
        await sequelize.query('INSERT INTO registration_events(registration_id,from_status,to_status,actor_id,note,created_at) VALUES (:id,:from,:to,:actor,:note,NOW())', { replacements: { id, from: previous, to: dto.status, actor: currentUser.id, note: dto.note || null }, transaction });
      }
      await group.update({ status: dto.status ?? group.status, assigned_to: dto.assigned_to === undefined ? group.assigned_to : dto.assigned_to, store_id: dto.store_id === undefined ? group.store_id : dto.store_id }, { transaction });
    });
    const updated = await this.getById(id, currentUser);
    if (dto.status && ['hoan_thanh', 'huy'].includes(dto.status)) {
      const group = await RegistrationGroup.findByPk(id);
      if (group?.email) await emailService.enqueue(group.email, 'registration_status_changed', { customer_name: group.customer_name, registration_code: group.code || '', status: dto.status }, `registration:${id}:status:${dto.status}`);
    }
    return updated;
  },
};
