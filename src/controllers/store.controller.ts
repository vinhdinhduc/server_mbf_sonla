import { Request, Response } from 'express';
import { z } from 'zod';
import { storeService } from '../services/store.service';
import {
  createStoreSchema,
  listStoreQuerySchema,
  updateStoreSchema,
} from '../validators/store.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { nominatimProvider } from '../services/geocoding.service';

export const storeController = {
  async listPublic(req: Request, res: Response) {
    const query = listStoreQuerySchema.parse(req.query);
    const rows = await storeService.listPublic(query.ward_code);
    sendSuccess(res, rows);
  },

  async listWards(_req: Request, res: Response) {
    sendSuccess(res, await storeService.listWards());
  },

  async geocode(req: Request, res: Response) {
    const { address } = z.object({ address: z.string().trim().min(5).max(200) }).parse(req.query);
    sendSuccess(res, await nominatimProvider.search(address));
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
    sendSuccess(res, null, 'Đã ngừng hoạt động cửa hàng');
  },
};
