import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

import { passwordResetService, RESET_MESSAGE } from '../services/passwordReset.service';
import {
  requestResetSchema,
  verifyResetSchema,
  resetPasswordSchema,
} from '../validators/auth.validator';
import { sendSuccess } from '../utils/apiResponse';

const router = Router();
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const dto = requestResetSchema.parse(req.body);
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(
      res,
      await passwordResetService.request(dto.identifier, req.ip || 'unknown'),
      RESET_MESSAGE,
    );
  }),
);
router.post(
  '/verify-reset-otp',
  asyncHandler(async (req, res) => {
    const dto = verifyResetSchema.parse(req.body);
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, await passwordResetService.verify(dto.challenge, dto.otp));
  }),
);
router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const dto = resetPasswordSchema.parse(req.body);
    await passwordResetService.reset(dto.challenge, dto.reset_token, dto.password);
    sendSuccess(res, null, 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.');
  }),
);

router.post('/login', asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));
router.get('/me', authMiddleware, asyncHandler(authController.me));

export default router;
