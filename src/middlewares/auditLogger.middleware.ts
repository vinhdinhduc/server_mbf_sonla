import { NextFunction, Request, Response } from 'express';
import { AuditLog, AuditAction } from '../models/AuditLog.model';

/**
 * Middleware chung ghi audit_logs tu dong cho MOI route CRUD o /api/admin/*.
 * Gan vao route: router.post('/news', authMiddleware, checkRole([...]), auditLogger('news', 'create'), newsController.create)
 *
 * Cach hoat dong: gan TRUOC controller trong chuoi middleware nhung ghi de res.json
 * de "bat" duoc response ma controller tra ve. Chi ghi log khi response co success:true,
 * va CHAY SAU KHI response da duoc gui toi client (khong lam cham request, khong ghi log
 * neu thao tac that bai) - dung yeu cau muc 8.
 *
 * Controller/Service co the lam giau du lieu log (mo ta, gia tri cu/moi) bang cach gan
 * vao req.auditContext truoc khi goi res.json — middleware nay se doc lai neu co.
 */
export function auditLogger(module: string, action: AuditAction) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      const result = originalJson(body);

      if (body && body.success === true) {
        const ctx = req.auditContext;
        const targetIdFromParams = req.params?.id ? Number(req.params.id) : undefined;
        const targetIdFromBody = body?.data?.id !== undefined ? Number(body.data.id) : undefined;

        AuditLog.create({
          user_id: req.user?.id ?? null,
          action,
          module,
          target_id: ctx?.targetId ?? targetIdFromParams ?? targetIdFromBody ?? null,
          description: ctx?.description ?? `${action} ${module}`,
          old_value: (ctx?.oldValue as Record<string, unknown>) ?? null,
          new_value: (ctx?.newValue as Record<string, unknown>) ?? null,
          ip_address: req.ip ?? null,
        }).catch((err) => {
          // Khong lam gian doan response cua client neu ghi log that bai
          // eslint-disable-next-line no-console
          console.error('Ghi audit log that bai:', err);
        });
      }

      return result;
    };

    next();
  };
}
