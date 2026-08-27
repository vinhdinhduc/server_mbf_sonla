import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/login', asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));
router.get('/me', authMiddleware, asyncHandler(authController.me));

export default router;
