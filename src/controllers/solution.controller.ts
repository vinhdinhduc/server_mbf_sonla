import { Request, Response } from 'express';
import { solutionService } from '../services/solution.service';
import {
  createSolutionSchema,
  listSolutionQuerySchema,
  updateSolutionSchema,
} from '../validators/solution.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';

export const solutionController = {
  async listPublic(req: Request, res: Response) {
    const query = listSolutionQuerySchema.parse(req.query);
    const rows = await solutionService.listPublic(query.category);
    sendSuccess(res, rows);
  },

  async getPublicBySlug(req: Request, res: Response) {
    const sol = await solutionService.getPublicBySlug(req.params.slug);
    sendSuccess(res, sol);
  },

  async listAdmin(_req: Request, res: Response) {
    const rows = await solutionService.listAdmin();
    sendSuccess(res, rows);
  },

  async getById(req: Request, res: Response) {
    const sol = await solutionService.getById(Number(req.params.id));
    sendSuccess(res, sol);
  },

  async create(req: Request, res: Response) {
    const dto = createSolutionSchema.parse(req.body);
    const sol = await solutionService.create(dto);
    req.auditContext = { module: 'solutions', action: 'create', targetId: sol.id, newValue: dto };
    sendCreated(res, sol, 'Tao giai phap thanh cong');
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateSolutionSchema.parse(req.body);
    const sol = await solutionService.update(id, dto);
    req.auditContext = { module: 'solutions', action: 'update', targetId: id, newValue: dto };
    sendSuccess(res, sol, 'Cap nhat giai phap thanh cong');
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    await solutionService.remove(id);
    req.auditContext = { module: 'solutions', action: 'delete', targetId: id };
    sendSuccess(res, null, 'Xoa giai phap thanh cong');
  },
};
