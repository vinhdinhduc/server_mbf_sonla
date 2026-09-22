import { Request, Response } from 'express';
import { z } from 'zod';
import { rateLimitAdmin } from '../services/rateLimit.service';
import { sendSuccess } from '../utils/apiResponse';

const policySchema = z.object({ enabled: z.boolean().optional(), max_requests: z.number().int().min(1).max(100000).optional(), window_seconds: z.number().int().min(1).max(86400).optional(), block_seconds: z.number().int().min(1).max(86400).optional(), key_by: z.enum(['ip', 'phone', 'ip_username', 'user']).optional(), message: z.string().min(1).max(255).optional() });
const ruleSchema = z.object({ kind: z.enum(['allow', 'block']), cidr: z.string().max(64), reason: z.string().max(255).optional(), expires_at: z.coerce.date().nullable().optional() });
export const rateLimitController = {
  async list(_req: Request, res: Response) { sendSuccess(res, await rateLimitAdmin.list()); },
  async save(req: Request, res: Response) { await rateLimitAdmin.savePolicy(req.params.key, policySchema.parse(req.body)); sendSuccess(res, await rateLimitAdmin.list()); },
  async addRule(req: Request, res: Response) { const body = ruleSchema.parse(req.body); await rateLimitAdmin.addRule(body.kind, body.cidr, body.reason, body.expires_at); sendSuccess(res, await rateLimitAdmin.list()); },
  async removeRule(req: Request, res: Response) { await rateLimitAdmin.removeRule(Number(req.params.id)); sendSuccess(res, await rateLimitAdmin.list()); },
  async unblock(req: Request, res: Response) { await rateLimitAdmin.unblock(String(req.body.key)); sendSuccess(res, await rateLimitAdmin.list()); },
  async reset(_req: Request, res: Response) { await rateLimitAdmin.reset(); sendSuccess(res, await rateLimitAdmin.list()); },
  async stats(_req: Request, res: Response) { sendSuccess(res, await rateLimitAdmin.stats()); },
};
