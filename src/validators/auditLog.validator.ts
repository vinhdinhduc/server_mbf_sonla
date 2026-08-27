import { z } from 'zod';

export const auditLogActionEnum = z.enum(['create', 'update', 'delete', 'login', 'logout']);

export const listAuditLogQuerySchema = z.object({
  user_id: z.coerce.number().int().positive().optional(),
  module: z.string().optional(),
  action: auditLogActionEnum.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(20),
});

export type ListAuditLogQueryDto = z.infer<typeof listAuditLogQuerySchema>;
