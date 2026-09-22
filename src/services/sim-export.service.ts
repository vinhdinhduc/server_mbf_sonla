/* eslint-disable no-await-in-loop, no-restricted-syntax -- Luồng xuất ghi từng lô, chờ backpressure trước khi đọc tiếp. */
import ExcelJS from 'exceljs';
import { once } from 'events';
import { Writable } from 'stream';
import { Op } from 'sequelize';
import { z } from 'zod';
import { SimNumber } from '../models/SimNumber.model';
import { exportSimQuerySchema } from '../validators/sim.validator';
import { settingService } from './setting.service';

type ExportQuery = z.infer<typeof exportSimQuerySchema>;
type ColumnKey = ExportQuery['columns'][number];

const columns: Array<{ key: ColumnKey; label: string; width: number; numFmt?: string }> = [
  { key: 'phone', label: 'Số thuê bao', width: 16, numFmt: '@' },
  { key: 'subscription', label: 'Hình thức', width: 14 },
  { key: 'catalog', label: 'Nhóm', width: 16 },
  { key: 'pattern', label: 'Kiểu số', width: 16 },
  { key: 'fee', label: 'Phí hòa mạng', width: 18, numFmt: '#,##0' },
  { key: 'commitment', label: 'Cam kết (tháng)', width: 18 },
  { key: 'status', label: 'Trạng thái', width: 15 },
  { key: 'note', label: 'Ghi chú', width: 32 },
  { key: 'createdAt', label: 'Ngày tạo', width: 22 },
];

function exportWhere(query: ExportQuery) {
  if (query.scope === 'all') return {};
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
  return where;
}

function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  // Ngăn công thức CSV từ ghi chú do người dùng nhập.
  const safe = /^\s*[=+\-@]/.test(raw) || /^[\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

async function writeChunk(stream: Writable, chunk: string) {
  if (!stream.write(chunk)) await once(stream, 'drain');
}

export const simExportService = {
  async count(query: ExportQuery) {
    return Math.min(100000, await SimNumber.count({ where: exportWhere(query) }));
  },

  async stream(query: ExportQuery, output: Writable) {
    const selected = columns.filter((column) => query.columns.includes(column.key));
    const [prepaidValue, postpaidValue] = await Promise.all([
      settingService.getRawValue('sim_activation_fee_prepaid'),
      settingService.getRawValue('sim_activation_fee_postpaid'),
    ]);
    const fees = {
      prepaid: Number(prepaidValue ?? 50000),
      postpaid: Number(postpaidValue ?? 60000),
    };
    const workbook =
      query.format === 'xlsx'
        ? new ExcelJS.stream.xlsx.WorkbookWriter({ stream: output, useStyles: true })
        : null;
    const sheet = workbook?.addWorksheet('Kho sim', { views: [{ state: 'frozen', ySplit: 1 }] });
    if (sheet) {
      sheet.columns = selected.map((column) => ({
        header: column.label,
        key: column.key,
        width: column.width,
        style: column.numFmt ? { numFmt: column.numFmt } : undefined,
      }));
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).commit();
    } else {
      await writeChunk(
        output,
        `\uFEFF${selected.map((column) => csvCell(column.label)).join(',')}\r\n`,
      );
    }

    let cursor = 0;
    let exported = 0;
    while (exported < 100000 && !output.destroyed) {
      const rows = await SimNumber.findAll({
        where: { ...exportWhere(query), id: { [Op.gt]: cursor } },
        order: [['id', 'ASC']],
        limit: Math.min(1000, 100000 - exported),
      });
      if (rows.length === 0) break;
      for (const row of rows) {
        const values: Record<ColumnKey, string | number | Date> = {
          phone: row.phone_number,
          subscription: row.subscription_type === 'prepaid' ? 'Trả trước' : 'Trả sau',
          catalog: row.catalog,
          pattern: row.sim_type,
          fee: fees[row.subscription_type],
          commitment: row.commitment_months ?? 0,
          status: row.status,
          note: row.bundle_note ?? '',
          createdAt: row.created_at,
        };
        if (sheet) {
          sheet
            .addRow(Object.fromEntries(selected.map((column) => [column.key, values[column.key]])))
            .commit();
        } else {
          await writeChunk(
            output,
            `${selected
              .map((column) =>
                csvCell(
                  values[column.key] instanceof Date
                    ? (values[column.key] as Date).toISOString()
                    : values[column.key],
                ),
              )
              .join(',')}\r\n`,
          );
        }
      }
      exported += rows.length;
      cursor = rows[rows.length - 1].id;
    }
    if (sheet && workbook) {
      sheet.commit();
      await workbook.commit();
    } else {
      output.end();
    }
    return exported;
  },
};
