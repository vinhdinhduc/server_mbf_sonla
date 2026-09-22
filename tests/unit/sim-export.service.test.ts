import { PassThrough } from 'stream';
import ExcelJS from 'exceljs';
import { SimNumber } from '../../src/models/SimNumber.model';
import { simExportService } from '../../src/services/sim-export.service';
import { settingService } from '../../src/services/setting.service';
import { exportSimQuerySchema } from '../../src/validators/sim.validator';

describe('sim-export.service', () => {
  afterEach(() => jest.restoreAllMocks());

  it('ghi CSV theo lô, giữ số 0 và chống công thức trong ghi chú', async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      id: index + 1,
      phone_number: `090${String(index).padStart(7, '0')}`,
      subscription_type: 'prepaid',
      bundle_note: index === 0 ? '=HYPERLINK("malicious")' : '',
      created_at: new Date('2026-09-22T00:00:00Z'),
    }));
    const findAll = jest.spyOn(SimNumber, 'findAll')
      .mockResolvedValueOnce(rows.slice(0, 1000) as SimNumber[])
      .mockResolvedValueOnce(rows.slice(1000) as SimNumber[])
      .mockResolvedValueOnce([]);
    jest.spyOn(settingService, 'getRawValue').mockResolvedValue(null);
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    const query = exportSimQuerySchema.parse({ format: 'csv', columns: 'phone,note', scope: 'all' });

    expect(await simExportService.stream(query, output)).toBe(1001);
    const content = Buffer.concat(chunks).toString('utf8');
    expect(content.startsWith('\uFEFF"Số thuê bao","Ghi chú"\r\n')).toBe(true);
    expect(content).toContain('"0900000000","\'=HYPERLINK(');
    expect(content.split('\r\n')).toHaveLength(1003);
    expect(findAll).toHaveBeenCalledTimes(3);
  });

  it('ghi XLSX với số thuê bao dạng text và phí định dạng số', async () => {
    jest.spyOn(SimNumber, 'findAll')
      .mockResolvedValueOnce([{
        id: 1,
        phone_number: '0901234567',
        subscription_type: 'postpaid',
        catalog: 'so_dep',
        sim_type: 'thuong',
        status: 'available',
        commitment_months: 0,
        bundle_note: '',
        created_at: new Date('2026-09-22T00:00:00Z'),
      }] as SimNumber[])
      .mockResolvedValueOnce([]);
    jest.spyOn(settingService, 'getRawValue').mockResolvedValue(null);
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    const query = exportSimQuerySchema.parse({ format: 'xlsx', columns: 'phone,fee', scope: 'all' });

    expect(await simExportService.stream(query, output)).toBe(1);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.concat(chunks) as any);
    const sheet = workbook.getWorksheet('Kho sim');
    expect(sheet?.getCell('A2').value).toBe('0901234567');
    expect(sheet?.getCell('B2').value).toBe(60000);
    expect(sheet?.getColumn(1).numFmt).toBe('@');
    expect(sheet?.getColumn(2).numFmt).toBe('#,##0');
  });
});
