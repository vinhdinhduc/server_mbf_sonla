import { Request, Response } from 'express';
import { packageService } from '../services/package.service';
import {
  createPackageSchema,
  listPackageQuerySchema,
  updatePackageSchema,
} from '../validators/package.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';

function parsePackageBody(body: Record<string, unknown>, file?: Express.Multer.File) {
  const result = { ...body };
  for (const key of ['badges', 'benefits']) if (typeof result[key] === 'string') result[key] = JSON.parse(result[key] as string);
  if (typeof result.effective_from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.effective_from)) result.effective_from = new Date(`${result.effective_from}T00:00:00+07:00`);
  if (typeof result.effective_to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.effective_to)) result.effective_to = new Date(`${result.effective_to}T23:59:59+07:00`);
  if (result.effective_from === '') result.effective_from = null;
  if (result.effective_to === '') result.effective_to = null;
  if (file) result.image_url = `/uploads/${file.filename}`;
  return result;
}

export const packageController = {
  async listPublic(req: Request, res: Response) {
    const query = listPackageQuerySchema.parse(req.query);
    const rows = await packageService.listPublic(query.group_type);
    sendSuccess(res, rows);
  },

  async getPublicBySlug(req: Request, res: Response) {
    const pkg = await packageService.getPublicBySlug(req.params.slug);
    sendSuccess(res, pkg);
  },

  async listAdmin(_req: Request, res: Response) {
    const rows = await packageService.listAdmin();
    sendSuccess(res, rows);
  },

  async getById(req: Request, res: Response) {
    const pkg = await packageService.getById(Number(req.params.id));
    sendSuccess(res, pkg);
  },

  async create(req: Request, res: Response) {
    const dto = createPackageSchema.parse(parsePackageBody(req.body, req.file));
    const pkg = await packageService.create(dto);
    req.auditContext = { module: 'packages', action: 'create', targetId: pkg.id, newValue: dto };
    sendCreated(res, pkg, 'Tạo gói cước thành công');
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updatePackageSchema.parse(parsePackageBody(req.body, req.file));
    const pkg = await packageService.update(id, dto);
    req.auditContext = { module: 'packages', action: 'update', targetId: id, newValue: dto };
    sendSuccess(res, pkg, 'Cập nhật gói cước thành công');
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    await packageService.remove(id);
    req.auditContext = { module: 'packages', action: 'delete', targetId: id };
    sendSuccess(res, null, 'Xóa gói cước thành công');
  },
};
