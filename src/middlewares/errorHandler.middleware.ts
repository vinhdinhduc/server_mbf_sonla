import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandlerMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => e.message).join('; ');
    const fields = Object.fromEntries(
      err.errors.map((issue) => [issue.path.join('.') || '_form', issue.message]),
    );
    res.status(422).json({
      success: false,
      data: null,
      message,
      error: { code: 'VALIDATION_ERROR', message, fields },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      data: null,
      message: err.message,
      error: { code: `HTTP_${err.statusCode}`, message: err.message },
    });
    return;
  }

  // Loi khong luong truoc - khong lo dieu tiet thong tin nhay cam ra ngoai production
  // eslint-disable-next-line no-console
  console.error(err);
  const message =
    env.NODE_ENV === 'production'
      ? 'Lỗi hệ thống, vui lòng thử lại sau'
      : (err as Error)?.message || 'Lỗi hệ thống';
  res.status(500).json({
    success: false,
    data: null,
    message,
    error: { code: 'INTERNAL_ERROR', message },
  });
}
