import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { loginSchema } from '../validators/auth.validator';
import { sendSuccess } from '../utils/apiResponse';

export const authController = {
  async login(req: Request, res: Response) {
    const dto = loginSchema.parse(req.body);
    const result = await authService.login(dto);
    sendSuccess(res, result, 'Đăng nhập thành công');
  },

  async logout(_req: Request, res: Response) {
    // JWT la stateless - logout xu ly o phia client (xoa token). Tra ve thanh cong de client don du lieu.
    sendSuccess(res, null, 'Đăng xuất thành công');
  },

  async me(req: Request, res: Response) {
    const user = await authService.getMe(req.user!.id);
    sendSuccess(res, user);
  },
};
