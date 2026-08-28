import { Request, Response } from 'express';
import { sliderService } from '../services/slider.service';
import {
  createSliderItemSchema,
  updateSliderItemSchema,
  updateSliderZoneSchema,
} from '../validators/slider.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';

export const sliderController = {
  async getPublicByZoneCode(req: Request, res: Response) {
    const result = await sliderService.getPublicByZoneCode(req.params.zoneCode);
    sendSuccess(res, result);
  },

  async listZones(_req: Request, res: Response) {
    const rows = await sliderService.listZones();
    sendSuccess(res, rows);
  },

  async updateZone(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateSliderZoneSchema.parse(req.body);
    const zone = await sliderService.updateZone(id, dto);
    req.auditContext = { module: 'sliders', action: 'update', targetId: id, newValue: dto };
    sendSuccess(res, zone, 'Cập nhật khu vực slider thành công');
  },

  async listItems(req: Request, res: Response) {
    const zoneId = Number(req.query.zone_id);
    if (!zoneId) throw AppError.badRequest('Thiếu tham số zone_id');
    const rows = await sliderService.listItems(zoneId);
    sendSuccess(res, rows);
  },

  async createItem(req: Request, res: Response) {
    const dto = createSliderItemSchema.parse(req.body);
    const item = await sliderService.createItem(dto);
    req.auditContext = { module: 'sliders', action: 'create', targetId: item.id, newValue: dto };
    sendCreated(res, item, 'Tạo slide thành công');
  },

  async updateItem(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateSliderItemSchema.parse(req.body);
    const item = await sliderService.updateItem(id, dto);
    req.auditContext = { module: 'sliders', action: 'update', targetId: id, newValue: dto };
    sendSuccess(res, item, 'Cập nhật slide thành công');
  },

  async removeItem(req: Request, res: Response) {
    const id = Number(req.params.id);
    await sliderService.removeItem(id);
    req.auditContext = { module: 'sliders', action: 'delete', targetId: id };
    sendSuccess(res, null, 'Xóa slide thành công');
  },
};
