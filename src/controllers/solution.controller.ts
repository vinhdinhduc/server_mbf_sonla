import { Request, Response } from 'express';
import { solutionService } from '../services/solution.service';
import {
  createSolutionSchema,
  listSolutionQuerySchema,
  updateSolutionSchema,
} from '../validators/solution.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';

function parseNestedFields(body: Record<string, unknown>) {
  const result = { ...body } as Record<string, unknown>;
  for (const key of ['features', 'pricing', 'faqs', 'gallery']) {
    if (typeof result[key] === 'string') result[key] = JSON.parse(result[key] as string);
  }
  return result;
}

export const solutionController = {
  async listPublic(req: Request, res: Response) {
    const query = listSolutionQuerySchema.parse(req.query);
    const result = await solutionService.listPublic(query);
    sendSuccess(res, result);
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
    const dto = createSolutionSchema.parse({
      ...parseNestedFields(req.body),
      ...(req.file ? { thumbnail: `/uploads/${req.file.filename}` } : {}),
    });
    const sol = await solutionService.create(dto);
    req.auditContext = { module: 'solutions', action: 'create', targetId: sol.id, newValue: dto };
    sendCreated(res, sol, 'Tạo giải pháp thành công');
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateSolutionSchema.parse({
      ...parseNestedFields(req.body),
      ...(req.file ? { thumbnail: `/uploads/${req.file.filename}` } : {}),
    });
    const sol = await solutionService.update(id, dto);
    req.auditContext = { module: 'solutions', action: 'update', targetId: id, newValue: dto };
    sendSuccess(res, sol, 'Cập nhật giải pháp thành công');
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    await solutionService.remove(id);
    req.auditContext = { module: 'solutions', action: 'delete', targetId: id };
    sendSuccess(res, null, 'Xóa giải pháp thành công');
  },
};
