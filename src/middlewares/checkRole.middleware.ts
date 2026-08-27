import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { UserRole } from '../models/User.model';

/**
 * Middleware kiem tra vai tro. Dung o tang route cho MOI route /api/admin/*
 * (bao mat that su phai chan o tang API, khong dua vao an/hien UI frontend - muc 4).
 * Loc chi tiet hon theo assigned_to (vd role nhan_vien) duoc xu ly them trong Service.
 */
export function checkRole(allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw AppError.unauthorized();
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw AppError.forbidden();
    }
    next();
  };
}
