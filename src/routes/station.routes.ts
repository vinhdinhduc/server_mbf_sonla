import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth.middleware';
import { checkRole } from '../middlewares/checkRole.middleware';
import { auditLogger } from '../middlewares/auditLogger.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { stationService } from '../services/station.service';
import { nominatimProvider } from '../services/geocoding.service';
import {
  nearestStationQuerySchema,
  stationIdSchema,
  stationQuerySchema,
  stationSchema,
} from '../validators/station.validator';

const router = Router();
router.use(authMiddleware, checkRole(['admin']));
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});
router.get(
  '/',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await stationService.list(stationQuerySchema.parse(req.query)));
  }),
);
router.get(
  '/nearest',
  asyncHandler(async (req, res) => {
    const query = nearestStationQuerySchema.parse(req.query);
    sendSuccess(res, await stationService.nearest(query.latitude, query.longitude, query.limit));
  }),
);
router.get(
  '/geocode',
  asyncHandler(async (req, res) => {
    const { address } = z.object({ address: z.string().trim().min(5).max(200) }).parse(req.query);
    sendSuccess(res, await nominatimProvider.search(address));
  }),
);
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await stationService.get(stationIdSchema.parse(req.params.id)));
  }),
);
router.post(
  '/',
  auditLogger('stations', 'create'),
  asyncHandler(async (req, res) => {
    const dto = stationSchema.parse(req.body);
    const station = await stationService.save(dto);
    req.auditContext = {
      module: 'stations',
      action: 'create',
      targetId: station.id,
      newValue: dto,
    };
    sendCreated(res, station, 'Đã tạo trạm BTS');
  }),
);
router.put(
  '/:id',
  auditLogger('stations', 'update'),
  asyncHandler(async (req, res) => {
    const id = stationIdSchema.parse(req.params.id);
    const dto = stationSchema.parse(req.body);
    const previous = (await stationService.get(id)).toJSON();
    const station = await stationService.save(dto, id);
    req.auditContext = {
      module: 'stations',
      action: 'update',
      targetId: id,
      oldValue: previous,
      newValue: dto,
    };
    sendSuccess(res, station, 'Đã cập nhật trạm BTS');
  }),
);
router.delete(
  '/:id',
  auditLogger('stations', 'delete'),
  asyncHandler(async (req, res) => {
    const id = stationIdSchema.parse(req.params.id);
    const previous = await stationService.remove(id);
    req.auditContext = { module: 'stations', action: 'delete', targetId: id, oldValue: previous };
    sendSuccess(res, null, 'Đã xóa trạm BTS');
  }),
);
export default router;
