import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { trashService } from '../services/trash.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import { bulkDeleteSchema, trashIdParamsSchema } from '../validators/trash.validator';
import { confirmDeleteSchema } from '../validators/confirmDelete.validator';

export const trashController = {
  async list(_req: Request, res: Response) {
    sendSuccess(res, await trashService.list());
  },

  async softDeleteMany(req: Request, res: Response) {
    const { type } = req.params;
    const parsedType = trashIdParamsSchema.shape.type.parse(type);
    const dto = bulkDeleteSchema.parse(req.body);
    if (!req.user?.id) throw AppError.unauthorized();
    await authService.verifyPassword(req.user.id, dto.password);
    const deleted = await trashService.removeMany(parsedType, dto.ids);
    req.auditContext = {
      module: parsedType,
      action: 'delete',
      targetIds: deleted.map((row) => row.id),
      description: `Xóa mềm ${deleted.length} ${trashService.moduleLabel(parsedType)} đã chọn`,
      oldValue: { records: deleted.map(({ id, status }) => ({ id, status })) },
    };
    sendSuccess(res, { deleted: deleted.length }, `Đã xóa mềm ${deleted.length} bản ghi`);
  },

  async restore(req: Request, res: Response) {
    const { type, id } = trashIdParamsSchema.parse(req.params);
    const restored = await trashService.restore(type, id);
    req.auditContext = {
      module: type,
      action: 'update',
      targetId: id,
      description: `Khôi phục ${trashService.moduleLabel(type)} ${restored.label}`,
      oldValue: { deleted: true },
      newValue: { restored: true },
    };
    sendSuccess(res, restored, 'Đã khôi phục bản ghi');
  },

  async permanentlyRemove(req: Request, res: Response) {
    const { type, id } = trashIdParamsSchema.parse(req.params);
    const dto = confirmDeleteSchema.parse(req.body);
    if (!req.user?.id) throw AppError.unauthorized();
    await authService.verifyPassword(req.user.id, dto.password);
    const removed = await trashService.permanentlyRemove(type, id);
    req.auditContext = {
      module: type,
      action: 'delete',
      targetId: id,
      description: `Xóa vĩnh viễn ${trashService.moduleLabel(type)} ${removed.label}`,
      oldValue: { status: removed.status },
    };
    sendSuccess(res, null, 'Đã xóa vĩnh viễn bản ghi');
  },
};
