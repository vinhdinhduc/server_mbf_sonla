import { SIM_IMPORT_HEADERS, resolveSimImportHeader } from './sim-import-columns';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { createHash } from 'crypto';
import path from 'path';
import { InferCreationAttributes, literal, Op } from 'sequelize';
import { z } from 'zod';
import { sequelize } from '../config/database';
import {
  SimNumber,
  SimCatalog,
  SimType,
  SimStatus,
  SubscriptionType,
} from '../models/SimNumber.model';
import { settingService } from './setting.service';
import { AppError } from '../utils/AppError';
import {
  CreateSimDto,
  UpdateSimDto,
  exportSimQuerySchema,
  listAdminSimQuerySchema,
} from '../validators/sim.validator';

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

export interface ImportPreview extends ImportResult {
  digest: string;
  total: number;
  sample: Array<{ row: number; phone_number: string; subscription_type: string; action: string }>;
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
const IMPORT_VALUE_LABELS: Record<string, string> = {
  prepaid: 'Trả trước',
  postpaid: 'Trả sau',
  so_dep: 'Số đẹp',
  phong_thuy: 'Phong thủy',
  nam_sinh: 'Năm sinh',
  tra_truoc: 'Trả trước',
  sim_data: 'SIM data',
  esim: 'eSIM',
  tam_hoa: 'Tam hoa',
  tu_quy: 'Tứ quý',
  phat_loc: 'Phát lộc',
  than_tai: 'Thần tài',
  thuong: 'Thông thường',
  available: 'Đang bán',
  reserved: 'Đang giữ',
  sold: 'Đã bán',
  hidden: 'Ẩn',
};
const viValues = (values: string[]) =>
  values.map((value) => IMPORT_VALUE_LABELS[value] ?? value).join(', ');

function getRelationshipAttribute(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`(?:^|\\s)${name}=(["'])(.*?)\\1`))?.[2];
}

function resolveRelationshipPath(relsPath: string, target: string): string {
  const resolved = target.startsWith('/')
    ? path.posix.normalize(target)
    : path.posix.normalize(`${relsPath.replace(/\/_rels\/[^/]+$/, '')}/${target}`);
  return resolved.replace(/^\/+/, '');
}

async function removeWorkbookAnnotations(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const relsPaths = Object.keys(zip.files).filter((name) =>
    /^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(name),
  );
  const changed = await Promise.all(
    relsPaths.map(async (relsPath) => {
      const relsFile = zip.file(relsPath);
      if (!relsFile) return false;

      const relsXml = await relsFile.async('string');
      const removedRelationshipIds = new Set<string>();
      let hasAnnotations = false;
      const updatedRelsXml = relsXml.replace(/<Relationship\b[^>]*\/>/g, (tag) => {
        const type = getRelationshipAttribute(tag, 'Type');
        if (!type?.endsWith('/comments') && !type?.endsWith('/vmlDrawing')) return tag;

        hasAnnotations = true;
        const id = getRelationshipAttribute(tag, 'Id');
        if (id) removedRelationshipIds.add(id);
        const target = getRelationshipAttribute(tag, 'Target');
        if (target) {
          const targetPath = resolveRelationshipPath(relsPath, target);
          if (targetPath.startsWith('xl/')) zip.remove(targetPath);
        }
        return '';
      });

      if (!hasAnnotations) return false;

      const sheetPath = relsPath.replace('/_rels/', '/').replace(/\.rels$/, '');
      const sheetFile = zip.file(sheetPath);
      if (sheetFile) {
        const sheetXml = await sheetFile.async('string');
        const updatedSheetXml = sheetXml.replace(/<legacyDrawing\b[^>]*\/>/g, (tag) => {
          const id = getRelationshipAttribute(tag, 'r:id');
          return id && removedRelationshipIds.has(id) ? '' : tag;
        });
        if (updatedSheetXml !== sheetXml) zip.file(sheetPath, updatedSheetXml);
      }

      if (updatedRelsXml !== relsXml) zip.file(relsPath, updatedRelsXml);
      return true;
    }),
  );

  if (!changed.some(Boolean)) return buffer;
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 1 },
  });
}

export const simService = {
  async listPublic(
    query: string | undefined,
    prefix: string | undefined,
    catalog: string | undefined,
    simType: string | undefined,
    priceRange: string | undefined,
    subscriptionType: SubscriptionType | 'all',
    page?: number,
    pageSize?: number,
    element?: 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ',
    fitElement?: boolean,
  ) {
    await SimNumber.update(
      { status: 'available', reserved_until: null, reserved_registration_id: null },
      { where: { status: 'reserved', reserved_until: { [Op.lt]: new Date() } } },
    );
    const where: Record<string, unknown> = {
      status: 'available',
    };
    if (subscriptionType !== 'all') where.subscription_type = subscriptionType;
    const phoneNumberFilters: object[] = [];
    if (query) {
      const pattern = query.includes('*') ? query.replace(/\*/g, '%') : `%${query}%`;
      phoneNumberFilters.push({ [Op.like]: pattern });
    }
    if (prefix) where.prefix = prefix;
    if (catalog) where.catalog = catalog;
    if (simType) where.sim_type = simType;
    if (fitElement && element) {
      const elementDigits = {
        Kim: ['6', '7'],
        Mộc: ['3', '4'],
        Thủy: ['0', '1'],
        Hỏa: ['9'],
        Thổ: ['2', '5', '8'],
      }[element];
      phoneNumberFilters.push({
        [Op.or]: elementDigits.map((digit) => ({ [Op.like]: `%${digit}` })),
      });
    }
    if (phoneNumberFilters.length === 1) where.phone_number = phoneNumberFilters[0];
    if (phoneNumberFilters.length > 1) where.phone_number = { [Op.and]: phoneNumberFilters };
    if (priceRange) {
      const [min, max] = priceRange.split('-').map(Number);
      if (!Number.isNaN(min) && !Number.isNaN(max)) {
        where.price = { [Op.between]: [min, max] };
      }
    }
    const effectivePage = page ?? 1;
    const effectivePageSize = pageSize ?? 20;
    const [result, configuredFee, commitmentCount] = await Promise.all([
      SimNumber.findAndCountAll({
        where,
        order: [
          ...(element
            ? [
                [
                  literal(
                    `CASE WHEN RIGHT(phone_number, 1) IN (${
                      {
                        Kim: "'6','7'",
                        Mộc: "'3','4'",
                        Thủy: "'0','1'",
                        Hỏa: "'9'",
                        Thổ: "'2','5','8'",
                      }[element]
                    }) THEN 0 ELSE 1 END`,
                  ),
                  'ASC',
                ] as [ReturnType<typeof literal>, 'ASC'],
              ]
            : []),
          ['phone_number', 'ASC'],
        ],
        limit: effectivePageSize,
        offset: (effectivePage - 1) * effectivePageSize,
      }),
      subscriptionType === 'all'
        ? Promise.all([
            settingService.getRawValue('sim_activation_fee_prepaid'),
            settingService.getRawValue('sim_activation_fee_postpaid'),
          ])
        : settingService.getRawValue(`sim_activation_fee_${subscriptionType}`),
      SimNumber.count({
        where: {
          ...where,
          [Op.or]: [
            { commitment_months: { [Op.gt]: 0 } },
            { committed_monthly_fee: { [Op.gt]: 0 } },
          ],
        },
      }),
    ]);
    const rows = Array.isArray(result) ? result : result.rows;
    const feePair = Array.isArray(configuredFee) ? configuredFee : null;
    const singleFee = typeof configuredFee === 'string' ? configuredFee : null;
    const items = rows.map((row) => {
      const activationFee =
        subscriptionType === 'all'
          ? Number(
              feePair?.[row.subscription_type === 'prepaid' ? 0 : 1] ??
                (row.subscription_type === 'prepaid' ? 50000 : 60000),
            )
          : Number(singleFee ?? (subscriptionType === 'prepaid' ? 50000 : 60000));
      return { ...row.toJSON(), activation_fee: activationFee };
    });
    const totalPages = Math.max(1, Math.ceil(result.count / effectivePageSize));
    return {
      items,
      total: result.count,
      totalPages,
      page: effectivePage,
      pageSize: effectivePageSize,
      page_size: effectivePageSize,
      hasCommitment: commitmentCount > 0,
    };
  },

  async getPublicById(id: number) {
    const sim = await SimNumber.findOne({ where: { id, status: 'available' } });
    if (!sim) throw AppError.notFound('Không tìm thấy số sim');
    const configuredFee = await settingService.getRawValue(
      `sim_activation_fee_${sim.subscription_type}`,
    );
    return {
      ...sim.toJSON(),
      activation_fee: Number(
        configuredFee ?? (sim.subscription_type === 'prepaid' ? 50000 : 60000),
      ),
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
      const columnIndexes = query.columns.map((column) =>
        [
          'phone',
          'subscription',
          'catalog',
          'pattern',
          'fee',
          'commitment',
          'status',
          'note',
          'createdAt',
        ].indexOf(column),
      );
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
          .filter((_, index) => columnIndexes.includes(index))
          .map(escapeCsv)
          .join(','),
      );
      return {
        buffer: Buffer.from(
          `\uFEFF${[
            header
              .filter((_, index) => columnIndexes.includes(index))
              .map(escapeCsv)
              .join(','),
            ...lines,
          ].join('\r\n')}`,
          'utf8',
        ),
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
    ].filter((column) => query.columns.includes(column.key as (typeof query.columns)[number]));
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
    return SimNumber.create({
      ...dto,
      committed_monthly_fee:
        dto.subscription_type === 'postpaid' ? (dto.committed_monthly_fee ?? null) : null,
      prefix: dto.phone_number.slice(0, 3),
    });
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
      ...((dto.subscription_type ?? sim.subscription_type) === 'prepaid'
        ? { committed_monthly_fee: null }
        : {}),
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
  async importFromExcel(
    buffer: Buffer,
    duplicateMode: 'skip' | 'update',
    previewOnly = false,
  ): Promise<ImportResult | ImportPreview> {
    const workbook = new ExcelJS.Workbook();
    try {
      const importBuffer = await removeWorkbookAnnotations(buffer);
      await workbook.xlsx.load(importBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch {
      throw AppError.badRequest(
        'Không đọc được file Excel. Hãy mở file bằng Excel và lưu lại định dạng .xlsx, sau đó thử import lại.',
      );
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw AppError.badRequest('File Excel không có trang dữ liệu');
    if (sheet.rowCount > 20001) {
      throw AppError.badRequest('File import chỉ được chứa tối đa 20.000 dòng dữ liệu');
    }

    const columns = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, index) => {
      const name = resolveSimImportHeader(cell.text);
      if (columns.has(name)) throw AppError.badRequest(`Cột bị lặp: ${name}`);
      columns.set(name, index);
    });
    const requiredColumns = ['phone_number', 'subscription_type', 'catalog', 'sim_type'];
    const missingColumns = requiredColumns.filter((name) => !columns.has(name));
    if (missingColumns.length) {
      throw AppError.badRequest(
        `Thiếu cột bắt buộc: ${missingColumns.join(', ')}. Tải mẫu import kho SIM để đối chiếu tên cột.`,
      );
    }

    const errors: ImportRowError[] = [];
    const validRows: Array<CreateSimDto & { prefix: string }> = [];
    const sample: ImportPreview['sample'] = [];
    const seenInFile = new Set<string>();
    let skippedDuplicates = 0;
    let updated = 0;
    let total = 0;

    const existingPhones = new Set(
      (await SimNumber.findAll({ attributes: ['phone_number'] })).map((s) => s.phone_number),
    );

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // dong header
      total += 1;

      const getCell = (name: string) =>
        columns.has(name) ? row.getCell(columns.get(name)!).value : null;
      const phoneNumber = String(getCell('phone_number') ?? '').trim();
      const subscriptionType = String(
        getCell('subscription_type') ?? '',
      ).trim() as SubscriptionType;
      const catalog = String(getCell('catalog') ?? '').trim() as SimCatalog;
      const simType = String(getCell('sim_type') ?? '').trim() as SimType;
      const priceRaw = getCell('price') ?? getCell('price_deprecated');
      const price = Number(priceRaw);
      const bundleNote = getCell('bundle_note');
      const commitmentRaw = getCell('commitment_months');
      const monthlyRaw = getCell('committed_monthly_fee');
      const monthlyFee = monthlyRaw === null || monthlyRaw === '' ? null : Number(monthlyRaw);
      if (
        monthlyFee !== null &&
        (!Number.isInteger(monthlyFee) || monthlyFee < 0 || monthlyFee > 999999999999)
      ) {
        errors.push({
          row: rowNumber,
          message: 'Mức cước cam kết/tháng phải là số nguyên không âm, tối đa 999999999999 đồng',
        });
        return;
      }
      const statusRaw = String(getCell('status') ?? 'available').trim() as SimStatus;

      if (
        commitmentRaw !== null &&
        commitmentRaw !== undefined &&
        commitmentRaw !== '' &&
        (!Number.isInteger(Number(commitmentRaw)) ||
          Number(commitmentRaw) < 0 ||
          Number(commitmentRaw) > 36)
      ) {
        errors.push({ row: rowNumber, message: 'Cam kết phải là số nguyên từ 0 đến 36 tháng' });
        return;
      }
      if (!VALID_STATUSES.includes(statusRaw)) {
        errors.push({
          row: rowNumber,
          message: `Cột “${SIM_IMPORT_HEADERS.status}”: “${IMPORT_VALUE_LABELS[statusRaw] ?? statusRaw}” không hợp lệ. Chọn một trong: ${viValues(VALID_STATUSES)}.`,
        });
        return;
      }

      if (!phoneNumber) {
        errors.push({
          row: rowNumber,
          message: `Cột “${SIM_IMPORT_HEADERS.phone_number}” đang để trống.`,
        });
        return;
      }
      if (!/^0\d{9}$/.test(phoneNumber)) {
        errors.push({
          row: rowNumber,
          message: `Cột “${SIM_IMPORT_HEADERS.phone_number}”: “${phoneNumber}” không hợp lệ; nhập đủ 10 chữ số và bắt đầu bằng 0.`,
        });
        return;
      }
      if (!VALID_SUBSCRIPTION_TYPES.includes(subscriptionType)) {
        errors.push({
          row: rowNumber,
          message: `Cột “${SIM_IMPORT_HEADERS.subscription_type}”: “${subscriptionType || '(trống)'}” không hợp lệ. Chọn “Trả trước” hoặc “Trả sau”.`,
        });
        return;
      }
      if (!VALID_CATALOGS.includes(catalog)) {
        errors.push({
          row: rowNumber,
          message: `Cột “${SIM_IMPORT_HEADERS.catalog}”: “${IMPORT_VALUE_LABELS[catalog] ?? catalog}” không hợp lệ. Chọn một trong: ${viValues(VALID_CATALOGS)}.`,
        });
        return;
      }
      if (!VALID_SIM_TYPES.includes(simType)) {
        errors.push({
          row: rowNumber,
          message: `Cột “${SIM_IMPORT_HEADERS.sim_type}”: “${IMPORT_VALUE_LABELS[simType] ?? simType}” không hợp lệ. Chọn một trong: ${viValues(VALID_SIM_TYPES)}.`,
        });
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
        if (sample.length < 20)
          sample.push({
            row: rowNumber,
            phone_number: phoneNumber,
            subscription_type: subscriptionType,
            action: 'Bỏ qua',
          });
        return;
      }
      if (existingPhones.has(phoneNumber)) updated += 1;
      const status = VALID_STATUSES.includes(statusRaw) ? statusRaw : 'available';

      seenInFile.add(phoneNumber);
      if (sample.length < 20)
        sample.push({
          row: rowNumber,
          phone_number: phoneNumber,
          subscription_type: subscriptionType,
          action: existingPhones.has(phoneNumber) ? 'Cập nhật' : 'Thêm',
        });
      validRows.push({
        phone_number: phoneNumber,
        prefix: phoneNumber.slice(0, 3),
        subscription_type: subscriptionType,
        catalog,
        sim_type: simType,
        ...(columns.has('price') || columns.has('price_deprecated') ? { price } : {}),
        committed_monthly_fee: subscriptionType === 'postpaid' ? monthlyFee : null,
        bundle_note: bundleNote ? String(bundleNote) : null,
        commitment_months: commitmentRaw ? Number(commitmentRaw) : null,
        status,
      });
    });

    if (!previewOnly && validRows.length > 0) {
      await sequelize.transaction(async (t) => {
        await SimNumber.bulkCreate(validRows as unknown as InferCreationAttributes<SimNumber>[], {
          transaction: t,
          updateOnDuplicate:
            duplicateMode === 'update'
              ? [
                  'prefix',
                  'subscription_type',
                  'catalog',
                  'sim_type',
                  ...(columns.has('price') || columns.has('price_deprecated')
                    ? ['price' as const]
                    : []),
                  'committed_monthly_fee',
                  'bundle_note',
                  'commitment_months',
                  'status',
                ]
              : undefined,
        });
      });
    }

    const result = {
      inserted: validRows.length - updated,
      updated,
      skipped: skippedDuplicates + errors.length,
      errors,
    };
    if (!previewOnly) return result;
    return { ...result, digest: createHash('sha256').update(buffer).digest('hex'), total, sample };
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
      {
        header: SIM_IMPORT_HEADERS.phone_number,
        key: 'phone_number',
        width: 18,
        style: { numFmt: '@' },
      },
      { header: SIM_IMPORT_HEADERS.subscription_type, key: 'subscription_type', width: 20 },
      { header: SIM_IMPORT_HEADERS.catalog, key: 'catalog', width: 18 },
      { header: SIM_IMPORT_HEADERS.sim_type, key: 'sim_type', width: 16 },
      { header: SIM_IMPORT_HEADERS.bundle_note, key: 'bundle_note', width: 32 },
      {
        header: SIM_IMPORT_HEADERS.committed_monthly_fee,
        key: 'committed_monthly_fee',
        width: 28,
        style: { numFmt: '#,##0' },
      },
      { header: SIM_IMPORT_HEADERS.commitment_months, key: 'commitment_months', width: 22 },
      { header: SIM_IMPORT_HEADERS.status, key: 'status', width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.addRow({
      phone_number: '0901234567',
      subscription_type: 'postpaid',
      catalog: 'so_dep',
      sim_type: 'thuong',
      committed_monthly_fee: 150000,
      bundle_note: 'Ghi chú tùy chọn',
      commitment_months: 24,
      status: 'available',
    });
    sheet.getCell('F1').note =
      'Mức cước cam kết tối thiểu mỗi tháng, đơn vị đồng; chỉ áp dụng SIM trả sau. Để trống nếu SIM không yêu cầu cam kết gói cước.';
    sheet.getCell('G1').note =
      'Số tháng duy trì mức cước cam kết (0–36). Để trống nếu SIM không yêu cầu cam kết gói cước.';
    const instructions = workbook.addWorksheet('Hướng dẫn');
    instructions.columns = [{ width: 28 }, { width: 110 }];
    instructions.addRows([
      ['Cột', 'Giá trị hợp lệ'],
      [
        SIM_IMPORT_HEADERS.committed_monthly_fee,
        'Mức cước tối thiểu/tháng (đồng), không phải phí hòa mạng. Để trống nếu không cam kết hoặc SIM trả trước.',
      ],
      [
        SIM_IMPORT_HEADERS.commitment_months,
        'Số tháng duy trì (0–36). Để trống nếu không cam kết.',
      ],
      [
        'Chuẩn hóa file cũ',
        '150.000 24 tháng → committed_monthly_fee = 150000 và commitment_months = 24. Nhập số thuần, không kèm đơn vị. Không tự chuyển price/price_deprecated thành cước cam kết.',
      ],
      [SIM_IMPORT_HEADERS.subscription_type, 'prepaid | postpaid'],
      [SIM_IMPORT_HEADERS.catalog, viValues(VALID_CATALOGS)],
      [SIM_IMPORT_HEADERS.sim_type, viValues(VALID_SIM_TYPES)],
      [SIM_IMPORT_HEADERS.status, viValues(VALID_STATUSES)],
    ]);
    instructions.getRow(1).font = { bold: true };
    const output = await workbook.xlsx.writeBuffer();
    return Buffer.from(output);
  },
};
