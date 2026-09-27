import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { AuthUserPayload } from '../types/express';
import { User } from '../models/User.model';

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  void (async () => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      throw AppError.unauthorized('Thiếu hoặc sai định dạng token');
    let payload: AuthUserPayload & { session_version?: number };
    try {
      payload = jwt.verify(header.slice(7).trim(), env.JWT_SECRET) as typeof payload;
    } catch {
      throw AppError.unauthorized('Token không hợp lệ hoặc đã hết hạn');
    }
    const user = await User.findByPk(payload.id);
    if (
      !user ||
      user.status !== 'active' ||
      (payload.session_version ?? 0) !== user.session_version
    )
      throw AppError.unauthorized('Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.');
    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  })().catch(next);
}
