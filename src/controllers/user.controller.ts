import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { createUserSchema, updateUserSchema } from '../validators/user.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';

export const userController = {
  async list(_req: Request, res: Response) {
    const rows = await userService.list();
    sendSuccess(res, rows);
  },

  async getById(req: Request, res: Response) {
    const user = await userService.getById(Number(req.params.id));
    sendSuccess(res, user);
  },

  async create(req: Request, res: Response) {
    const dto = createUserSchema.parse({
      ...req.body,
      ...(req.file ? { avatar_url: `/uploads/${req.file.filename}` } : {}),
    });
    const user = await userService.create(dto);
    req.auditContext = {
      module: 'users',
      action: 'create',
      targetId: user.id,
      newValue: { ...dto, password: undefined },
    };
    sendCreated(res, user, 'Tạo tài khoản thành công');
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateUserSchema.parse({
      ...req.body,
      ...(req.file ? { avatar_url: `/uploads/${req.file.filename}` } : {}),
    });
    const user = await userService.update(id, dto, req.user!.id);
    req.auditContext = {
      module: 'users',
      action: 'update',
      targetId: id,
      newValue: { ...dto, password: undefined },
    };
    sendSuccess(res, user, 'Cập nhật tài khoản thành công');
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    await userService.remove(id, req.user!.id);
    req.auditContext = { module: 'users', action: 'delete', targetId: id };
    sendSuccess(res, null, 'Xóa tài khoản thành công');
  },
};
