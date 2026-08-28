import { Request, Response } from 'express';
import { storeService } from '../services/store.service';
import {
  createStoreSchema,
  listStoreQuerySchema,
  updateStoreSchema,
} from '../validators/store.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';

export const storeController = {
  async listPublic(req: Request, res: Response) {
    const query = listStoreQuerySchema.parse(req.query);
    const rows = await storeService.listPublic(query.district);
    sendSuccess(res, rows);
  },

  async listAdmin(_req: Request, res: Response) {
    const rows = await storeService.listAdmin();
    sendSuccess(res, rows);
  },

  async getById(req: Request, res: Response) {
    const store = await storeService.getById(Number(req.params.id));
    sendSuccess(res, store);
  },

  async create(req: Request, res: Response) {
    const dto = createStoreSchema.parse(req.body);
    const store = await storeService.create(dto);
    req.auditContext = { module: 'stores', action: 'create', targetId: store.id, newValue: dto };
    sendCreated(res, store, 'Tạo cửa hàng thành công');
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateStoreSchema.parse(req.body);
    const store = await storeService.update(id, dto);
    req.auditContext = { module: 'stores', action: 'update', targetId: id, newValue: dto };
    sendSuccess(res, store, 'Cập nhật cửa hàng thành công');
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    await storeService.remove(id);
    req.auditContext = { module: 'stores', action: 'delete', targetId: id };
    sendSuccess(res, null, 'Xóa cửa hàng thành công  ');
  },
};
