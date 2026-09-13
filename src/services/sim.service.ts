import ExcelJS from 'exceljs';
import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import { SimNumber, SimCatalog, SimType, SimStatus } from '../models/SimNumber.model';
import { AppError } from '../utils/AppError';
import { CreateSimDto, UpdateSimDto } from '../validators/sim.validator';

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: ImportRowError[];
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
const VALID_STATUSES: SimStatus[] = ['available', 'reserved', 'sold'];

// Cot theo dung thu tu mau: phone_number | prefix | catalog | sim_type | price | bundle_note | commitment_months | status
const COLUMN_MAP = {
  phone_number: 1,
  prefix: 2,
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
  ) {
    const where: Record<string, unknown> = { status: 'available' };
    if (query) {
      const pattern = query.replace(/\*/g, '%');
      where.phone_number = { [Op.like]: `%${pattern}%` };
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
    return SimNumber.findAll({ where, order: [['price', 'ASC']] });
  },

  async getPublicById(id: number) {
    const sim = await SimNumber.findOne({ where: { id, status: 'available' } });
    if (!sim) throw AppError.notFound('Khong tim thay so sim');
    return sim;
  },

  async listAdmin() {
    return SimNumber.findAll({ order: [['id', 'DESC']] });
  },

  async getById(id: number) {
    const sim = await SimNumber.findByPk(id);
    if (!sim) throw AppError.notFound('Khong tim thay so sim');
    return sim;
  },

  async create(dto: CreateSimDto) {
    const existing = await SimNumber.findOne({ where: { phone_number: dto.phone_number } });
    if (existing) throw AppError.badRequest('So dien thoai da ton tai trong kho');
    return SimNumber.create(dto);
  },

  async update(id: number, dto: UpdateSimDto) {
    const sim = await this.getById(id);
    if (dto.phone_number && dto.phone_number !== sim.phone_number) {
      const existing = await SimNumber.findOne({
        where: { phone_number: dto.phone_number, id: { [Op.ne]: id } },
      });
      if (existing) throw AppError.badRequest('So dien thoai da ton tai trong kho');
    }
    await sim.update(dto);
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
  async importFromExcel(buffer: Buffer): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw AppError.badRequest('File Excel khong co sheet du lieu');

    const errors: ImportRowError[] = [];
    const validRows: CreateSimDto[] = [];
    const seenInFile = new Set<string>();

    const existingPhones = new Set(
      (await SimNumber.findAll({ attributes: ['phone_number'] })).map((s) => s.phone_number),
    );

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // dong header

      const getCell = (col: number) => row.getCell(col).value;
      const phoneNumber = String(getCell(COLUMN_MAP.phone_number) ?? '').trim();
      const prefix = String(getCell(COLUMN_MAP.prefix) ?? '').trim();
      const catalog = String(getCell(COLUMN_MAP.catalog) ?? '').trim() as SimCatalog;
      const simType = String(getCell(COLUMN_MAP.sim_type) ?? '').trim() as SimType;
      const priceRaw = getCell(COLUMN_MAP.price);
      const price = Number(priceRaw);
      const bundleNote = getCell(COLUMN_MAP.bundle_note);
      const commitmentRaw = getCell(COLUMN_MAP.commitment_months);
      const statusRaw = String(getCell(COLUMN_MAP.status) ?? 'available').trim() as SimStatus;

      if (!phoneNumber) {
        errors.push({ row: rowNumber, message: 'Thieu phone_number' });
        return;
      }
      if (!prefix) {
        errors.push({ row: rowNumber, message: 'Thieu prefix' });
        return;
      }
      if (!VALID_CATALOGS.includes(catalog)) {
        errors.push({ row: rowNumber, message: `catalog khong hop le: ${catalog}` });
        return;
      }
      if (!VALID_SIM_TYPES.includes(simType)) {
        errors.push({ row: rowNumber, message: `sim_type khong hop le: ${simType}` });
        return;
      }
      if (Number.isNaN(price) || price < 0) {
        errors.push({ row: rowNumber, message: 'price khong hop le' });
        return;
      }
      if (existingPhones.has(phoneNumber) || seenInFile.has(phoneNumber)) {
        errors.push({ row: rowNumber, message: `So ${phoneNumber} da ton tai / trung lap` });
        return;
      }
      const status = VALID_STATUSES.includes(statusRaw) ? statusRaw : 'available';

      seenInFile.add(phoneNumber);
      validRows.push({
        phone_number: phoneNumber,
        prefix,
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
        await SimNumber.bulkCreate(validRows as any, { transaction: t });
      });
    }

    return { inserted: validRows.length, skipped: errors.length, errors };
  },
};
