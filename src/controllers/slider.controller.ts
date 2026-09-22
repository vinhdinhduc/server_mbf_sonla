import { Request, Response } from 'express';
import { sliderService } from '../services/slider.service';
import {
  createSliderItemSchema,
  updateSliderItemSchema,
  updateSliderZoneSchema,
} from '../validators/slider.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import sharp from 'sharp';

async function imageDetails(file?: Express.Multer.File) {
  if (!file) return {};
  const metadata = await sharp(file.path).metadata();
  return { image_url: `/uploads/${file.filename}`, image_width: metadata.width, image_height: metadata.height, image_bytes: file.size };
}
function mobileImage(req: Request) {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  return files?.mobile_image?.[0] ? { mobile_image_url: `/uploads/${files.mobile_image[0].filename}` } : {};
}

function dateBounds(body: Record<string, unknown>) {
  const result = { ...body };
  if (result.start_date === '') result.start_date = null;
  if (result.end_date === '') result.end_date = null;
  if (typeof result.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.start_date)) result.start_date = new Date(`${result.start_date}T00:00:00+07:00`);
  if (typeof result.end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.end_date)) result.end_date = new Date(`${result.end_date}T23:59:59+07:00`);
  return result;
}

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
    const dto = createSliderItemSchema.parse({
      ...dateBounds(req.body),
      ...(await imageDetails(req.file)),
      ...mobileImage(req),
    });
    const item = await sliderService.createItem(dto);
    req.auditContext = { module: 'sliders', action: 'create', targetId: item.id, newValue: dto };
    sendCreated(res, item, 'Tạo slide thành công');
  },

  async updateItem(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateSliderItemSchema.parse({
      ...dateBounds(req.body),
      ...(await imageDetails(req.file)),
      ...mobileImage(req),
    });
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
