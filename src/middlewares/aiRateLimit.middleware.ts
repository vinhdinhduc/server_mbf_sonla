import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const requests = new Map<string, { count: number; resetAt: number }>();

export function aiRateLimit(req: Request, _res: Response, next: NextFunction): void {
  const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();
  const current = requests.get(key);
  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }
  if (current.count >= MAX_REQUESTS)
    throw AppError.tooManyRequests('Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.');
  current.count += 1;
  next();
}
