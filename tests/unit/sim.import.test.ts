import ExcelJS from 'exceljs';
import { SimNumber } from '../../src/models/SimNumber.model';
import { sequelize } from '../../src/config/database';
import { simService } from '../../src/services/sim.service';

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
    sheet.addRow(['phone_number', 'subscription_type', 'catalog', 'sim_type', 'price', 'bundle_note', 'commitment_months', 'status']);
    for (let index = 0; index < 1000; index += 1) {
      sheet.addRow([
        index < 10 ? `sai-${index}` : `090${String(index).padStart(7, '0')}`,
        index % 2 ? 'prepaid' : 'postpaid',
        'so_dep', 'thuong', null, null, 0, 'available',
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
    expect((mockedSim.bulkCreate.mock.calls[0][0] as unknown[])).toHaveLength(990);
  });
});
