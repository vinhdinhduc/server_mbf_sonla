import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { AuthUserPayload } from '../types/express';

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw AppError.unauthorized('Thiếu hoặc sai định dạng token');
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUserPayload;
    req.user = { id: payload.id, username: payload.username, role: payload.role };
    next();
  } catch (err) {
    throw AppError.unauthorized('Token không hợp lệ hoặc đã hết hạn');
  }
}
