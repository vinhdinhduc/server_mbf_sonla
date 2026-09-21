import ExcelJS from 'exceljs';
import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import { SimNumber, SimCatalog, SimType, SimStatus, SubscriptionType } from '../models/SimNumber.model';
import { settingService } from './setting.service';
import { AppError } from '../utils/AppError';
import { CreateSimDto, UpdateSimDto, exportSimQuerySchema, listAdminSimQuerySchema } from '../validators/sim.validator';
import { z } from 'zod';

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
}

export interface SimExportFile {
  buffer: Buffer;
  contentType: string;
  extension: 'csv' | 'xlsx';
  rowCount: number;
}

const VALID_CATALOGS: SimCatalog[] = [
  'so_dep',
  'phong_thuy',
  'nam_sinh',
  'tra_truoc',
  'sim_data',
  'esim',
];
const VALID_SIM_TYPES: SimType[] = ['tam_hoa', 'tu_quy', 'phat_loc', 'than_tai', 'thuong'];
const VALID_STATUSES: SimStatus[] = ['available', 'reserved', 'sold', 'hidden'];
const VALID_SUBSCRIPTION_TYPES: SubscriptionType[] = ['prepaid', 'postpaid'];

// Cột mẫu: phone_number | subscription_type | catalog | sim_type | price (cũ, tùy chọn) | bundle_note | commitment_months | status
const COLUMN_MAP = {
  phone_number: 1,
  subscription_type: 2,
  catalog: 3,
  sim_type: 4,
  price: 5,
  bundle_note: 6,
  commitment_months: 7,
  status: 8,
};

export const simService = {
  async listPublic(
    query: string | undefined,
    prefix: string | undefined,
    catalog: string | undefined,
    simType: string | undefined,
    priceRange: string | undefined,
    subscriptionType: SubscriptionType,
  ) {
    await SimNumber.update(
      { status: 'available', reserved_until: null, reserved_registration_id: null },
      { where: { status: 'reserved', reserved_until: { [Op.lt]: new Date() } } },
    );
    const where: Record<string, unknown> = { status: 'available', subscription_type: subscriptionType };
    if (query) {
      const pattern = query.includes('*') ? query.replace(/\*/g, '%') : `%${query}%`;
      where.phone_number = { [Op.like]: pattern };
    }
    if (prefix) where.prefix = prefix;
    if (catalog) where.catalog = catalog;
    if (simType) where.sim_type = simType;
    if (priceRange) {
      const [min, max] = priceRange.split('-').map(Number);
      if (!Number.isNaN(min) && !Number.isNaN(max)) {
        where.price = { [Op.between]: [min, max] };
      }
    }
    const [rows, configuredFee] = await Promise.all([
      SimNumber.findAll({ where, order: [['phone_number', 'ASC']] }),
      settingService.getRawValue(`sim_activation_fee_${subscriptionType}`),
    ]);
    const activationFee = Number(configuredFee ?? (subscriptionType === 'prepaid' ? 50000 : 60000));
    return rows.map((row) => ({ ...row.toJSON(), activation_fee: activationFee }));
  },

  async getPublicById(id: number) {
    const sim = await SimNumber.findOne({ where: { id, status: 'available' } });
    if (!sim) throw AppError.notFound('Không tìm thấy số sim');
    const configuredFee = await settingService.getRawValue(
      `sim_activation_fee_${sim.subscription_type}`,
    );
    return {
      ...sim.toJSON(),
      activation_fee: Number(configuredFee ?? (sim.subscription_type === 'prepaid' ? 50000 : 60000)),
    };
  },

  async listAdmin(query: z.infer<typeof listAdminSimQuerySchema>) {
    const where: Record<string, unknown> = {};
    if (query.q) {
      const pattern = query.q.includes('*') ? query.q.replace(/\*/g, '%') : `%${query.q}%`;
      where.phone_number = { [Op.like]: pattern };
    }
    if (query.prefix) where.prefix = query.prefix;
    if (query.catalog) where.catalog = query.catalog;
    if (query.sim_type) where.sim_type = query.sim_type;
    if (query.type) where.subscription_type = query.type;
    if (query.status) where.status = query.status;
    const { rows, count } = await SimNumber.findAndCountAll({
      where,
      order: [[query.sort, query.direction.toUpperCase()]],
      limit: query.page_size,
      offset: (query.page - 1) * query.page_size,
    });
    return { items: rows, total: count, page: query.page, page_size: query.page_size };
  },

  async exportData(query: z.infer<typeof exportSimQuerySchema>): Promise<SimExportFile> {
    const where: Record<string, unknown> = {};
    if (query.scope === 'filtered') {
      if (query.q) {
        const pattern = query.q.includes('*') ? query.q.replace(/\*/g, '%') : `%${query.q}%`;
        where.phone_number = { [Op.like]: pattern };
      }
      if (query.prefix) where.prefix = query.prefix;
      if (query.catalog) where.catalog = query.catalog;
      if (query.sim_type) where.sim_type = query.sim_type;
      if (query.type) where.subscription_type = query.type;
      if (query.status) where.status = query.status;
    }
    const [rows, prepaidValue, postpaidValue] = await Promise.all([
      SimNumber.findAll({ where, order: [['id', 'DESC']], limit: 100000 }),
      settingService.getRawValue('sim_activation_fee_prepaid'),
      settingService.getRawValue('sim_activation_fee_postpaid'),
    ]);
    const fees = {
      prepaid: Number(prepaidValue ?? 50000),
      postpaid: Number(postpaidValue ?? 60000),
    };
    const values = rows.map((row) => ({
      phone: row.phone_number,
      subscription: row.subscription_type === 'prepaid' ? 'Trả trước' : 'Trả sau',
      catalog: row.catalog,
      pattern: row.sim_type,
      fee: fees[row.subscription_type],
      commitment: row.commitment_months ?? 0,
      status: row.status,
      note: row.bundle_note ?? '',
      createdAt: row.created_at,
    }));

    if (query.format === 'csv') {
      const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const header = [
        'Số thuê bao',
        'Hình thức',
        'Nhóm',
        'Kiểu số',
        'Phí hòa mạng',
        'Cam kết (tháng)',
        'Trạng thái',
        'Ghi chú',
        'Ngày tạo',
      ];
      const lines = values.map((row) =>
        [
          `="${row.phone}"`,
          row.subscription,
          row.catalog,
          row.pattern,
          row.fee,
          row.commitment,
          row.status,
          row.note,
          row.createdAt.toISOString(),
        ]
          .map(escapeCsv)
          .join(','),
      );
      return {
        buffer: Buffer.from(`\uFEFF${[header.map(escapeCsv).join(','), ...lines].join('\r\n')}`, 'utf8'),
        contentType: 'text/csv; charset=utf-8',
        extension: 'csv',
        rowCount: rows.length,
      };
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Kho sim', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header: 'Số thuê bao', key: 'phone', width: 16, style: { numFmt: '@' } },
      { header: 'Hình thức', key: 'subscription', width: 14 },
      { header: 'Nhóm', key: 'catalog', width: 16 },
      { header: 'Kiểu số', key: 'pattern', width: 16 },
      { header: 'Phí hòa mạng', key: 'fee', width: 18, style: { numFmt: '#,##0' } },
      { header: 'Cam kết (tháng)', key: 'commitment', width: 18 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Ghi chú', key: 'note', width: 32 },
      { header: 'Ngày tạo', key: 'createdAt', width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };
    values.forEach((row) => sheet.addRow(row));
    const output = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(output),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      rowCount: rows.length,
    };
  },

  async getById(id: number) {
    const sim = await SimNumber.findByPk(id);
    if (!sim) throw AppError.notFound('Không tìm thấy số sim');
    return sim;
  },

  async create(dto: CreateSimDto) {
    const existing = await SimNumber.findOne({ where: { phone_number: dto.phone_number } });
    if (existing) throw AppError.badRequest('Số điện thoại đã tồn tại trong kho');
    return SimNumber.create({ ...dto, prefix: dto.phone_number.slice(0, 3) });
  },

  async update(id: number, dto: UpdateSimDto) {
    const sim = await this.getById(id);
    if (dto.phone_number && dto.phone_number !== sim.phone_number) {
      const existing = await SimNumber.findOne({
        where: { phone_number: dto.phone_number, id: { [Op.ne]: id } },
      });
      if (existing) throw AppError.badRequest('Số điện thoại đã tồn tại trong kho');
    }
    await sim.update({
      ...dto,
      ...(dto.phone_number ? { prefix: dto.phone_number.slice(0, 3) } : {}),
    });
    return sim;
  },

  async remove(id: number) {
    const sim = await this.getById(id);
    await sim.destroy();
  },

  /**
   * Import Excel kho sim so (POST /api/admin/sims/import, muc 12).
   *
   * CHIEN LUOC DA CHON (ghi ro theo yeu cau muc 12):
   * 1) Doc toan bo file, validate TUNG dong theo schema bang sim_numbers va
   *    kiem tra trung phone_number (ca voi DB lan trung lap ngay trong file).
   * 2) Cac dong LOI (thieu cot bat buoc, sai kieu, trung so) duoc GOM lai kem
   *    so dong loi va KHONG duoc dua vao danh sach insert.
   * 3) Chi cac dong HOP LE duoc bulkCreate trong 1 transaction DUY NHAT.
   *    => Neu transaction insert nay chinh no that bai (loi ha tang DB) thi
   *       moi rollback toan bo lo hop le; con cac dong loi tu dau da bi tach
   *       ra ngoai nen KHONG anh huong den viec insert cac dong hop le khac.
   *    Day la cach dam bao "1 dong loi khong lam rollback toan bo file" ma
   *    van giu tinh nguyen tu (transaction) cho phan du lieu da duoc chap nhan.
   */
  async importFromExcel(buffer: Buffer, duplicateMode: 'skip' | 'update'): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw AppError.badRequest('File Excel không có trang dữ liệu');
    if (sheet.rowCount > 20001) {
      throw AppError.badRequest('File import chỉ được chứa tối đa 20.000 dòng dữ liệu');
    }

    const errors: ImportRowError[] = [];
    const validRows: Array<CreateSimDto & { prefix: string }> = [];
    const seenInFile = new Set<string>();
    let skippedDuplicates = 0;
    let updated = 0;

    const existingPhones = new Set(
      (await SimNumber.findAll({ attributes: ['phone_number'] })).map((s) => s.phone_number),
    );

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // dong header

      const getCell = (col: number) => row.getCell(col).value;
      const phoneNumber = String(getCell(COLUMN_MAP.phone_number) ?? '').trim();
      const subscriptionType = String(
        getCell(COLUMN_MAP.subscription_type) ?? '',
      ).trim() as SubscriptionType;
      const catalog = String(getCell(COLUMN_MAP.catalog) ?? '').trim() as SimCatalog;
      const simType = String(getCell(COLUMN_MAP.sim_type) ?? '').trim() as SimType;
      const priceRaw = getCell(COLUMN_MAP.price);
      const price = Number(priceRaw);
      const bundleNote = getCell(COLUMN_MAP.bundle_note);
      const commitmentRaw = getCell(COLUMN_MAP.commitment_months);
      const statusRaw = String(getCell(COLUMN_MAP.status) ?? 'available').trim() as SimStatus;

      if (!phoneNumber) {
        errors.push({ row: rowNumber, message: 'Thiếu số điện thoại' });
        return;
      }
      if (!/^0\d{9}$/.test(phoneNumber)) {
        errors.push({ row: rowNumber, message: 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0' });
        return;
      }
      if (!VALID_SUBSCRIPTION_TYPES.includes(subscriptionType)) {
        errors.push({ row: rowNumber, message: 'Hình thức phải là prepaid hoặc postpaid' });
        return;
      }
      if (!VALID_CATALOGS.includes(catalog)) {
        errors.push({ row: rowNumber, message: `Nhóm hiển thị không hợp lệ: ${catalog}` });
        return;
      }
      if (!VALID_SIM_TYPES.includes(simType)) {
        errors.push({ row: rowNumber, message: `Kiểu số không hợp lệ: ${simType}` });
        return;
      }
      if (Number.isNaN(price) || price < 0) {
        errors.push({ row: rowNumber, message: 'Giá dữ liệu cũ không hợp lệ' });
        return;
      }
      if (seenInFile.has(phoneNumber)) {
        errors.push({ row: rowNumber, message: `Số ${phoneNumber} bị lặp trong file` });
        return;
      }
      if (existingPhones.has(phoneNumber) && duplicateMode === 'skip') {
        skippedDuplicates += 1;
        return;
      }
      if (existingPhones.has(phoneNumber)) updated += 1;
      const status = VALID_STATUSES.includes(statusRaw) ? statusRaw : 'available';

      seenInFile.add(phoneNumber);
      validRows.push({
        phone_number: phoneNumber,
        prefix: phoneNumber.slice(0, 3),
        subscription_type: subscriptionType,
        catalog,
        sim_type: simType,
        price,
        bundle_note: bundleNote ? String(bundleNote) : null,
        commitment_months: commitmentRaw ? Number(commitmentRaw) : null,
        status,
      });
    });

    if (validRows.length > 0) {
      await sequelize.transaction(async (t) => {
        await SimNumber.bulkCreate(validRows as any, {
          transaction: t,
          updateOnDuplicate:
            duplicateMode === 'update'
              ? [
                  'prefix',
                  'subscription_type',
                  'catalog',
                  'sim_type',
                  'price',
                  'bundle_note',
                  'commitment_months',
                  'status',
                ]
              : undefined,
        });
      });
    }

    return {
      inserted: validRows.length - updated,
      updated,
      skipped: skippedDuplicates + errors.length,
      errors,
    };
  },

  async bulkUpdateStatus(ids: number[], status: SimStatus) {
    const [updated] = await SimNumber.update({ status }, { where: { id: { [Op.in]: ids } } });
    return { updated };
  },

  async bulkRemove(ids: number[]) {
    const deleted = await SimNumber.destroy({ where: { id: { [Op.in]: ids } } });
    return { deleted };
  },

  async createImportTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mẫu kho sim', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header: 'phone_number', key: 'phone_number', width: 18, style: { numFmt: '@' } },
      { header: 'subscription_type', key: 'subscription_type', width: 20 },
      { header: 'catalog', key: 'catalog', width: 18 },
      { header: 'sim_type', key: 'sim_type', width: 16 },
      { header: 'price_deprecated', key: 'price', width: 18 },
      { header: 'bundle_note', key: 'bundle_note', width: 32 },
      { header: 'commitment_months', key: 'commitment_months', width: 22 },
      { header: 'status', key: 'status', width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.addRow({
      phone_number: '0901234567',
      subscription_type: 'postpaid',
      catalog: 'so_dep',
      sim_type: 'thuong',
      price: '',
      bundle_note: 'Ghi chú tùy chọn',
      commitment_months: 0,
      status: 'available',
    });
    const instructions = workbook.addWorksheet('Hướng dẫn');
    instructions.addRows([
      ['Cột', 'Giá trị hợp lệ'],
      ['subscription_type', 'prepaid | postpaid'],
      ['catalog', VALID_CATALOGS.join(' | ')],
      ['sim_type', VALID_SIM_TYPES.join(' | ')],
      ['status', VALID_STATUSES.join(' | ')],
    ]);
    instructions.getRow(1).font = { bold: true };
    const output = await workbook.xlsx.writeBuffer();
    return Buffer.from(output);
  },
};
