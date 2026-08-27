import { Request, Response } from 'express';
import { auditLogService } from '../services/auditLog.service';
import { listAuditLogQuerySchema } from '../validators/auditLog.validator';
import { sendSuccess } from '../utils/apiResponse';

export const auditLogController = {
  async list(req: Request, res: Response) {
    const query = listAuditLogQuerySchema.parse(req.query);
    const result = await auditLogService.find(query);
    sendSuccess(res, result);
  },

  // KHONG co method update/remove o day - Audit log la READ-ONLY tuyet doi (muc 4).
};
