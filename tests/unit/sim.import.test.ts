import ExcelJS from 'exceljs';
import { SimNumber } from '../../src/models/SimNumber.model';
import { sequelize } from '../../src/config/database';
import { simService } from '../../src/services/sim.service';
import { SIM_IMPORT_HEADERS } from '../../src/services/sim-import-columns';
import { createSimSchema, updateSimSchema } from '../../src/validators/sim.validator';

jest.mock('../../src/models/SimNumber.model');
jest.mock('../../src/config/database', () => ({ sequelize: { transaction: jest.fn() } }));

const mockedSim = SimNumber as jest.Mocked<typeof SimNumber>;
const mockedDb = sequelize as jest.Mocked<typeof sequelize>;

describe('M04 TC-09 - xem trước import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSim.findAll.mockResolvedValue([] as any);
    mockedDb.transaction.mockImplementation(async (callback: any) => callback({}));
    mockedSim.bulkCreate.mockResolvedValue([] as any);
  });

  it('không ghi DB khi xem trước; nhập 990 dòng hợp lệ và báo 10 dòng lỗi', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Kho sim');
    sheet.addRow([
      'phone_number',
      'subscription_type',
      'catalog',
      'sim_type',
      'price',
      'bundle_note',
      'commitment_months',
      'status',
    ]);
    for (let index = 0; index < 1000; index += 1) {
      sheet.addRow([
        index < 10 ? `sai-${index}` : `090${String(index).padStart(7, '0')}`,
        index % 2 ? 'prepaid' : 'postpaid',
        'so_dep',
        'thuong',
        null,
        null,
        0,
        'available',
      ]);
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const preview = await simService.importFromExcel(buffer, 'skip', true);
    expect(preview).toMatchObject({ inserted: 990, updated: 0, skipped: 10 });
    expect(preview.errors).toHaveLength(10);
    expect(mockedSim.bulkCreate).not.toHaveBeenCalled();

    const result = await simService.importFromExcel(buffer, 'skip');
    expect(result).toMatchObject({ inserted: 990, skipped: 10 });
    expect(mockedSim.bulkCreate).toHaveBeenCalledTimes(1);
    expect(mockedSim.bulkCreate.mock.calls[0][0] as unknown[]).toHaveLength(990);
  });
  it('mẫu mới lưu đúng cước và số tháng, có chú thích và không có cột giá cũ', async () => {
    const buffer = await simService.createImportTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    expect((sheet.getRow(1).values as string[]).slice(1)).toEqual(
      Object.values(SIM_IMPORT_HEADERS),
    );
    expect(sheet.getRow(1).values).not.toContain('price_deprecated');
    expect(sheet.getCell('F1').note).toBeTruthy();
    expect(sheet.getCell('G1').note).toBeTruthy();
    mockedSim.findAll.mockResolvedValue([{ phone_number: '0901234567' }] as any);
    expect(await simService.importFromExcel(buffer, 'update')).toMatchObject({
      updated: 1,
      skipped: 0,
    });
    expect(mockedSim.bulkCreate.mock.calls[0][0][0]).toMatchObject({
      committed_monthly_fee: 150000,
      commitment_months: 24,
    });
    const options = mockedSim.bulkCreate.mock.calls[0][1];
    expect(options?.updateOnDuplicate).toContain('committed_monthly_fee');
    expect(options?.updateOnDuplicate).not.toContain('price');
  });

  it('đọc theo tên cột; trả trước lưu null; báo lỗi cước âm, thập phân và chuỗi ghép', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('SIM');
    sheet.addRow([
      'committed_monthly_fee',
      'commitment_months',
      'sim_type',
      'catalog',
      'subscription_type',
      'phone_number',
    ]);
    [150000, -1, 1.5, '150.000 24 tháng', null].forEach((fee, index) => {
      sheet.addRow([
        fee,
        24,
        'thuong',
        'so_dep',
        index === 0 ? 'prepaid' : 'postpaid',
        `090123456${index}`,
      ]);
    });
    const result = await simService.importFromExcel(
      Buffer.from(await workbook.xlsx.writeBuffer()),
      'skip',
    );
    expect(result).toMatchObject({ inserted: 2, skipped: 3 });
    expect(mockedSim.bulkCreate.mock.calls[0][0][0]).toMatchObject({ committed_monthly_fee: null });
    expect(mockedSim.bulkCreate.mock.calls[0][0][1]).toMatchObject({ committed_monthly_fee: null });
  });

  it('nhận header tiếng Việt viết hoa, dư khoảng trắng và chặn tháng âm', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('SIM');
    sheet.addRow(
      Object.values(SIM_IMPORT_HEADERS).map(
        (header) => `  ${header.toUpperCase().replace(/ /g, '   ')}  `,
      ),
    );
    sheet.addRow(['0901234567', 'postpaid', 'so_dep', 'thuong', '', 300000, 24, 'available']);
    sheet.addRow(['0901234568', 'postpaid', 'so_dep', 'thuong', '', 150000, -2, 'available']);
    const result = await simService.importFromExcel(
      Buffer.from(await workbook.xlsx.writeBuffer()),
      'skip',
    );
    expect(result).toMatchObject({ inserted: 1, skipped: 1 });
    expect(mockedSim.bulkCreate.mock.calls[0][0][0]).toMatchObject({
      phone_number: '0901234567',
      committed_monthly_fee: 300000,
      commitment_months: 24,
    });
    expect(result.errors[0].message).toContain('0 đến 36');
  });

  it('chặn tháng âm khi tạo và sửa qua API', () => {
    expect(
      createSimSchema.safeParse({
        phone_number: '0901234567',
        subscription_type: 'postpaid',
        catalog: 'so_dep',
        sim_type: 'thuong',
        commitment_months: -2,
      }).success,
    ).toBe(false);
    expect(updateSimSchema.safeParse({ commitment_months: -2 }).success).toBe(false);
    expect(updateSimSchema.safeParse({ commitment_months: 0 }).success).toBe(true);
  });

  it('không suy diễn giá cũ thành cước cam kết', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('SIM');
    sheet.addRow([
      'phone_number',
      'subscription_type',
      'catalog',
      'sim_type',
      'price_deprecated',
      'commitment_months',
    ]);
    sheet.addRow(['0901234567', 'postpaid', 'so_dep', 'thuong', 150000, 24]);
    await simService.importFromExcel(Buffer.from(await workbook.xlsx.writeBuffer()), 'skip');
    expect(mockedSim.bulkCreate.mock.calls[0][0][0]).toMatchObject({
      price: 150000,
      committed_monthly_fee: null,
    });
  });

  it('xóa cước cam kết khi chuyển sang trả trước và giữ khi sửa field khác', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    mockedSim.findByPk.mockResolvedValue({ subscription_type: 'postpaid', update } as any);
    await simService.update(1, { subscription_type: 'prepaid' });
    expect(update).toHaveBeenLastCalledWith({
      subscription_type: 'prepaid',
      committed_monthly_fee: null,
    });
    await simService.update(1, { bundle_note: 'Ghi chú' });
    expect(update).toHaveBeenLastCalledWith({ bundle_note: 'Ghi chú' });
  });
});
