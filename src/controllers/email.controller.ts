import { Request, Response } from 'express';
import { z } from 'zod';
import { emailService } from '../services/email.service';
import { User } from '../models/User.model';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';

const smtpSchema = z.object({ host: z.string().min(1).max(255), port: z.number().int().min(1).max(65535), security: z.enum(['none', 'starttls', 'ssl']), username: z.string().min(1).max(255), password: z.string().min(1).max(500).optional(), from_name: z.string().min(1).max(100), from_email: z.string().email().max(255), reply_to: z.string().email().nullable().optional(), bcc: z.string().email().nullable().optional(), send_limit_hour: z.number().int().min(1).max(10000) });
const templateSchema = z.object({ subject: z.string().min(1).max(255), html: z.string().min(1).max(50000), enabled: z.boolean() });
export const emailController = {
  async config(_req: Request, res: Response) { sendSuccess(res, await emailService.config()); },
  async saveConfig(req: Request, res: Response) { sendSuccess(res, await emailService.saveConfig(smtpSchema.parse(req.body))); },
  async verify(_req: Request, res: Response) { sendSuccess(res, await emailService.verify()); },
  async test(req: Request, res: Response) { const user = await User.findByPk(req.user!.id); if (!user?.email) throw AppError.badRequest('Tài khoản chưa có email'); sendSuccess(res, await emailService.sendTest(user.email)); },
  async templates(_req: Request, res: Response) { sendSuccess(res, await emailService.templates()); },
  async saveTemplate(req: Request, res: Response) { await emailService.saveTemplate(req.params.key, templateSchema.parse(req.body)); sendSuccess(res, await emailService.templates()); },
  async preview(req: Request, res: Response) { sendSuccess(res, await emailService.preview(req.params.key)); },
  async restore(req: Request, res: Response) { await emailService.restoreTemplate(req.params.key); sendSuccess(res, await emailService.templates()); },
  async logs(req: Request, res: Response) { sendSuccess(res, await emailService.logs(Number(req.query.page) || 1)); },
  async retry(req: Request, res: Response) { await emailService.retry(Number(req.params.id)); sendSuccess(res, { queued: true }); },
  async suppressions(_req: Request, res: Response) { sendSuccess(res, await emailService.suppressions()); },
  async suppress(req: Request, res: Response) { const dto = z.object({ email: z.string().email(), reason: z.string().min(1).max(100) }).parse(req.body); await emailService.suppress(dto.email, dto.reason); sendSuccess(res, { ok: true }); },
  async unsuppress(req: Request, res: Response) { const dto = z.object({ email: z.string().email() }).parse(req.body); await emailService.unsuppress(dto.email); sendSuccess(res, { ok: true }); },
};
