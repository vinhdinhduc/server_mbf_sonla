import { Request, Response } from 'express';
import { simService } from '../services/sim.service';
import { createSimSchema, listSimQuerySchema, updateSimSchema } from '../validators/sim.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';

export const simController = {
  async listPublic(req: Request, res: Response) {
    const query = listSimQuerySchema.parse(req.query);
    const rows = await simService.listPublic(query.prefix, query.sim_type, query.price_range);
    sendSuccess(res, rows);
  },

  async getPublicById(req: Request, res: Response) {
    const sim = await simService.getPublicById(Number(req.params.id));
    sendSuccess(res, sim);
  },

  async listAdmin(_req: Request, res: Response) {
    const rows = await simService.listAdmin();
    sendSuccess(res, rows);
  },

  async getById(req: Request, res: Response) {
    const sim = await simService.getById(Number(req.params.id));
    sendSuccess(res, sim);
  },

  async create(req: Request, res: Response) {
    const dto = createSimSchema.parse(req.body);
    const sim = await simService.create(dto);
    req.auditContext = { module: 'sims', action: 'create', targetId: sim.id, newValue: dto };
    sendCreated(res, sim, 'Tao sim thanh cong');
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateSimSchema.parse(req.body);
    const sim = await simService.update(id, dto);
    req.auditContext = { module: 'sims', action: 'update', targetId: id, newValue: dto };
    sendSuccess(res, sim, 'Cap nhat sim thanh cong');
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    await simService.remove(id);
    req.auditContext = { module: 'sims', action: 'delete', targetId: id };
    sendSuccess(res, null, 'Xoa sim thanh cong');
  },

  async importExcel(req: Request, res: Response) {
    if (!req.file) throw AppError.badRequest('Vui long tai len file Excel (field name: file)');
    const result = await simService.importFromExcel(req.file.buffer);
    req.auditContext = {
      module: 'sims',
      action: 'create',
      description: `Import Excel: ${result.inserted} dong thanh cong, ${result.skipped} dong loi`,
    };
    sendSuccess(res, result, 'Import hoan tat');
  },
};
