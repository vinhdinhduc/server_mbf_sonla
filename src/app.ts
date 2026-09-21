import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { env, ALLOWED_ORIGINS_LIST } from './config/env';
import { sequelize, testDbConnection } from './config/database';
import './models'; // Khoi tao model + association (import side-effect)

import authRoutes from './routes/auth.routes';
import publicRoutes from './routes/public.routes';
import adminRoutes from './routes/admin.routes';
import { errorHandlerMiddleware } from './middlewares/errorHandler.middleware';
import { scheduleBackupCron } from './scripts/backupCron';
import { chatbotController } from './controllers/chatbot.controller';
import { chatbotMessageSchema } from './validators/chatbot.validator';
import { aiRateLimit } from './middlewares/aiRateLimit.middleware';
import { asyncHandler } from './utils/asyncHandler';
import { sendSuccess } from './utils/apiResponse';
import { securityHeaders } from './middlewares/securityHeaders.middleware';

const app = express();

app.disable('x-powered-by');
app.use(securityHeaders);

// Khi chạy sau reverse proxy, Express lấy IP client từ X-Forwarded-For.
// Local development vẫn trả về ::1 cho request từ chính máy này.
app.set('trust proxy', env.NODE_ENV === 'production');

// CORS - doc danh sach domain cho phep tu ALLOWED_ORIGINS (muc 14), khong hard-code
app.use(
  cors({
    origin: ALLOWED_ORIGINS_LIST,
    credentials: true,
  }),
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Phuc vu file tinh da upload (anh tin tuc, giai phap, slider...)
app.use('/uploads', express.static(path.resolve(process.cwd(), env.UPLOAD_DIR)));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok' }, message: '' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/admin', adminRoutes);

// Alias tương thích trong giai đoạn chuyển frontend sang API versioned.
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.post(
  '/api/chat',
  aiRateLimit,
  asyncHandler(async (req, res) => {
    const dto = chatbotMessageSchema.parse(req.body);
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    sendSuccess(res, await chatbotController.messageResult(dto.session_id, dto.message, ip));
  }),
);
app.use('/api/admin', adminRoutes);

// 404 handler cho route khong ton tai
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, data: null, message: 'Không tìm thấy đường dẫn API' });
});

// Middleware xu ly loi tap trung - PHAI dat sau cung (muc 3.2)
app.use(errorHandlerMiddleware);

async function bootstrap(): Promise<void> {
  await testDbConnection();
  scheduleBackupCron();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(
      `🚀 Server đang lắng nghe cổng ${env.PORT}; URL công khai: ${env.APP_BASE_URL} (env=${env.NODE_ENV})`,
    );
  });
}

if (require.main === module) {
  bootstrap().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('❌ Không thể khởi động máy chủ:', err);
    process.exit(1);
  });
}

export { app, sequelize };
