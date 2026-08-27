import { Request, Response } from 'express';
import { packageService } from '../services/package.service';
import {
  createPackageSchema,
  listPackageQuerySchema,
  updatePackageSchema,
} from '../validators/package.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';

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
    const dto = createPackageSchema.parse(req.body);
    const pkg = await packageService.create(dto);
    req.auditContext = { module: 'packages', action: 'create', targetId: pkg.id, newValue: dto };
    sendCreated(res, pkg, 'Tao goi cuoc thanh cong');
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updatePackageSchema.parse(req.body);
    const pkg = await packageService.update(id, dto);
    req.auditContext = { module: 'packages', action: 'update', targetId: id, newValue: dto };
    sendSuccess(res, pkg, 'Cap nhat goi cuoc thanh cong');
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    await packageService.remove(id);
    req.auditContext = { module: 'packages', action: 'delete', targetId: id };
    sendSuccess(res, null, 'Xoa goi cuoc thanh cong');
  },
};
