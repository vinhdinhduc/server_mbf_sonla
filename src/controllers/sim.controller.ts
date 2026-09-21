import { Request, Response } from 'express';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { simService } from '../services/sim.service';
import {
  bulkSimDeleteSchema,
  bulkSimStatusSchema,
  createSimSchema,
  exportSimQuerySchema,
  listAdminSimQuerySchema,
  listSimQuerySchema,
  updateSimSchema,
} from '../validators/sim.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { AuditLog } from '../models/AuditLog.model';

export const simController = {
  async listPublic(req: Request, res: Response) {
    const query = listSimQuerySchema.parse(req.query);
    const rows = await simService.listPublic(
      query.q,
      query.prefix,
      query.catalog,
      query.sim_type,
      query.price_range,
      query.type,
    );
    sendSuccess(res, rows);
  },

  async getPublicById(req: Request, res: Response) {
    const sim = await simService.getPublicById(Number(req.params.id));
    sendSuccess(res, sim);
  },

  async listAdmin(req: Request, res: Response) {
    const query = listAdminSimQuerySchema.parse(req.query);
    const result = await simService.listAdmin(query);
    sendSuccess(res, result);
  },

  async getById(req: Request, res: Response) {
    const sim = await simService.getById(Number(req.params.id));
    sendSuccess(res, sim);
  },

  async create(req: Request, res: Response) {
    const dto = createSimSchema.parse(req.body);
    const sim = await simService.create(dto);
    req.auditContext = { module: 'sims', action: 'create', targetId: sim.id, newValue: dto };
    sendCreated(res, sim, 'Tạo sim thành công');
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateSimSchema.parse(req.body);
    const sim = await simService.update(id, dto);
    req.auditContext = { module: 'sims', action: 'update', targetId: id, newValue: dto };
    sendSuccess(res, sim, 'Cập nhật sim thành công');
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    await simService.remove(id);
    req.auditContext = { module: 'sims', action: 'delete', targetId: id };
    sendSuccess(res, null, 'Xóa sim thành công');
  },

  async importExcel(req: Request, res: Response) {
    if (!req.file) throw AppError.badRequest('Vui lòng tải lên file Excel (tên trường: file)');
    if (req.file.buffer.subarray(0, 4).toString('hex') !== '504b0304')
      throw AppError.badRequest('Nội dung tệp không phải Excel .xlsx hợp lệ');
    const duplicateMode = req.body.mode === 'update' ? 'update' : 'skip';
    const digest = createHash('sha256').update(req.file.buffer).digest('hex');
    if (!/^[a-f0-9]{64}$/.test(req.body.digest ?? '') || req.body.digest !== digest) {
      throw AppError.badRequest('Tệp Excel đã thay đổi; vui lòng xem trước lại trước khi nhập');
    }
    try {
      const preview = jwt.verify(req.body.preview_token, env.JWT_SECRET) as {
        digest: string;
        mode: string;
        userId: number;
        purpose: string;
      };
      if (
        preview.digest !== digest ||
        preview.mode !== duplicateMode ||
        preview.userId !== req.user?.id ||
        preview.purpose !== 'sim-import'
      ) {
        throw new Error('Preview mismatch');
      }
    } catch {
      throw AppError.badRequest(
        'Phiên xem trước đã hết hạn hoặc không khớp; vui lòng xem trước lại',
      );
    }
    const result = await simService.importFromExcel(req.file.buffer, duplicateMode);
    req.auditContext = {
      module: 'sims',
      action: 'create',
      description: `Import Excel: thêm ${result.inserted}, cập nhật ${result.updated}, bỏ qua ${result.skipped}; chế độ ${duplicateMode}`,
    };
    sendSuccess(res, result, 'Nhập dữ liệu thành công');
  },

  async previewImport(req: Request, res: Response) {
    if (!req.file) throw AppError.badRequest('Vui lòng tải lên file Excel');
    if (req.file.buffer.subarray(0, 4).toString('hex') !== '504b0304')
      throw AppError.badRequest('Nội dung tệp không phải Excel .xlsx hợp lệ');
    if (req.body.mode !== 'skip' && req.body.mode !== 'update')
      throw AppError.badRequest('Chế độ xử lý trùng không hợp lệ');
    const result = await simService.importFromExcel(req.file.buffer, req.body.mode, true);
    const digest = createHash('sha256').update(req.file.buffer).digest('hex');
    const previewToken = jwt.sign(
      { digest, mode: req.body.mode, userId: req.user?.id, purpose: 'sim-import' },
      env.JWT_SECRET,
      { expiresIn: '10m' },
    );
    sendSuccess(res, { ...result, preview_token: previewToken });
  },

  async bulkUpdateStatus(req: Request, res: Response) {
    const dto = bulkSimStatusSchema.parse(req.body);
    const result = await simService.bulkUpdateStatus(dto.ids, dto.status);
    req.auditContext = { module: 'sims', action: 'update', newValue: dto };
    sendSuccess(res, result, `Đã cập nhật ${result.updated} số sim`);
  },

  async bulkRemove(req: Request, res: Response) {
    const dto = bulkSimDeleteSchema.parse(req.body);
    const result = await simService.bulkRemove(dto.ids);
    req.auditContext = { module: 'sims', action: 'delete', newValue: { ids: dto.ids } };
    sendSuccess(res, result, `Đã xóa mềm ${result.deleted} số sim`);
  },

  async downloadImportTemplate(_req: Request, res: Response) {
    const buffer = await simService.createImportTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="mau-import-kho-sim.xlsx"');
    res.send(buffer);
  },

  async exportData(req: Request, res: Response) {
    const query = exportSimQuerySchema.parse(req.query);
    const file = await simService.exportData(query);
    const stamp = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(new Date())
      .replace(/[-: ]/g, '');
    await AuditLog.create({
      user_id: req.user?.id ?? null,
      action: 'export',
      module: 'sims',
      description: `Xuất ${file.rowCount} dòng kho sim định dạng ${file.extension}; phạm vi ${query.scope}; bộ lọc ${JSON.stringify(query)}`,
      ip_address: req.ip ?? null,
    });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="kho-sim_${stamp}.${file.extension}"`,
    );
    res.send(file.buffer);
  },
};
