import { Request, Response } from 'express';
import { promotionService } from '../services/promotion.service';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import {
  createPromotionSchema, promotionEventSchema, promotionIdSchema,
  publicPromotionQuerySchema, updatePromotionSchema,
} from '../validators/promotion.validator';

export const promotionController = {
  async list(_req: Request, res: Response) {
    sendSuccess(res, await promotionService.list());
  },
  async get(req: Request, res: Response) {
    sendSuccess(res, await promotionService.get(promotionIdSchema.parse(req.params.id)));
  },
  async create(req: Request, res: Response) {
    const dto = createPromotionSchema.parse(req.body);
    const promotion = await promotionService.create(dto);
    req.auditContext = { module: 'promotions', action: 'create', targetId: promotion.id, newValue: promotion.toJSON() };
    sendCreated(res, promotion, 'Đã tạo chương trình khuyến mại');
  },
  async update(req: Request, res: Response) {
    const id = promotionIdSchema.parse(req.params.id);
    const dto = updatePromotionSchema.parse(req.body);
    const { promotion, previous } = await promotionService.update(id, dto);
    req.auditContext = { module: 'promotions', action: 'update', targetId: id, oldValue: previous, newValue: promotion.toJSON() };
    sendSuccess(res, promotion, 'Đã cập nhật chương trình khuyến mại');
  },
  async remove(req: Request, res: Response) {
    const id = promotionIdSchema.parse(req.params.id);
    const previous = await promotionService.remove(id);
    req.auditContext = { module: 'promotions', action: 'delete', targetId: id, oldValue: previous };
    sendSuccess(res, null, 'Đã xóa chương trình khuyến mại');
  },
  async listPublic(req: Request, res: Response) {
    sendSuccess(res, await promotionService.listPublic(publicPromotionQuerySchema.parse(req.query)));
  },
  async recordEvent(req: Request, res: Response) {
    const id = promotionIdSchema.parse(req.params.id);
    const dto = promotionEventSchema.parse(req.body);
    sendSuccess(res, await promotionService.recordEvent(id, dto));
  },
};
