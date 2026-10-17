import { Router } from 'express';
import { checkRole } from '../middlewares/checkRole.middleware';
import { auditLogger } from '../middlewares/auditLogger.middleware';
import { promotionController } from '../controllers/promotion.controller';
import { asyncHandler } from '../utils/asyncHandler';

// Authentication is applied by the parent /admin router before mounting this router.
export const adminPromotionRoutes = Router();
adminPromotionRoutes.use(checkRole(['admin']));
adminPromotionRoutes.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});
adminPromotionRoutes.get('/', asyncHandler(promotionController.list));
adminPromotionRoutes.get('/:id', asyncHandler(promotionController.get));
adminPromotionRoutes.post('/', auditLogger('promotions', 'create'), asyncHandler(promotionController.create));
adminPromotionRoutes.put('/:id', auditLogger('promotions', 'update'), asyncHandler(promotionController.update));
adminPromotionRoutes.delete('/:id', auditLogger('promotions', 'delete'), asyncHandler(promotionController.remove));

export const publicPromotionRoutes = Router();
publicPromotionRoutes.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
publicPromotionRoutes.get('/', asyncHandler(promotionController.listPublic));
publicPromotionRoutes.post('/:id/events', asyncHandler(promotionController.recordEvent));
