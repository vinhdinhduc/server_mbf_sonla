import { Request, Response } from 'express';
import { jobService } from '../services/job.service';
import {
  applyJobSchema,
  jobSchema,
  updateApplicationSchema,
  updateJobSchema,
} from '../validators/job.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { verifyRecaptcha } from '../utils/verifyRecaptcha';
import { promises as fs } from 'fs';
import { AppError } from '../utils/AppError';

export const jobController = {
  async listPublic(req: Request, res: Response) {
    sendSuccess(
      res,
      await jobService.listPublic({
        category: req.query.category as string,
        location: req.query.location as string,
        employment_type: req.query.employment_type as string,
        include_expired: req.query.include_expired === 'true',
      }),
    );
  },
  async detail(req: Request, res: Response) {
    sendSuccess(res, await jobService.publicDetail(req.params.slug));
  },
  async apply(req: Request, res: Response) {
    let result;
    try {
      const dto = applyJobSchema.parse(req.body);
      if (!req.file) throw AppError.badRequest('Vui lòng tải CV');
      await verifyRecaptcha(dto.recaptcha_token);
      result = await jobService.apply(dto, req.file);
    } catch (error) {
      // Multer has already written the CV before parsing multipart fields.
      // A rejected consent/validation request must not leave personal data behind.
      if (req.file) await fs.unlink(req.file.path).catch(() => undefined);
      if (error instanceof AppError || (error as Error).name === 'ZodError') throw error;
      throw AppError.internal('Chưa thể nhận hồ sơ. Vui lòng thử lại sau');
    }
    sendCreated(res, result, 'Đã nhận hồ sơ ứng tuyển');
  },
  async listAdmin(_req: Request, res: Response) {
    sendSuccess(res, await jobService.listAdmin());
  },
  async get(req: Request, res: Response) {
    sendSuccess(res, await jobService.get(Number(req.params.id)));
  },
  async create(req: Request, res: Response) {
    const dto = jobSchema.parse(req.body);
    const item = await jobService.create(dto, req.user!.id);
    req.auditContext = { module: 'jobs', action: 'create', targetId: item.id, newValue: dto };
    sendCreated(res, item);
  },
  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateJobSchema.parse(req.body);
    const item = await jobService.update(id, dto);
    req.auditContext = { module: 'jobs', action: 'update', targetId: id, newValue: dto };
    sendSuccess(res, item);
  },
  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    await jobService.remove(id);
    req.auditContext = { module: 'jobs', action: 'delete', targetId: id };
    sendSuccess(res, null);
  },
  async applications(_req: Request, res: Response) {
    sendSuccess(res, await jobService.applications());
  },
  async updateApplication(req: Request, res: Response) {
    sendSuccess(
      res,
      await jobService.updateApplication(
        Number(req.params.id),
        updateApplicationSchema.parse(req.body),
      ),
    );
  },
  async cv(req: Request, res: Response) {
    const item = await jobService.cv(Number(req.params.id));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(item.cv_path, item.cv_original_name, (error) => {
      if (!error) return;
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.status(404).json({ success: false, data: null, message: 'Không tìm thấy CV' });
    });
  },
  async exportApplications(_req: Request, res: Response) {
    const buffer = await jobService.exportApplications();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="ho-so-ung-tuyen.xlsx"');
    res.send(buffer);
  },
};
