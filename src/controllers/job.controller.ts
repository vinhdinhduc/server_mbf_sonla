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
    const dto = applyJobSchema.parse(req.body);
    await verifyRecaptcha(dto.recaptcha_token);
    const result = await jobService.apply(dto, req.file!);
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
    res.download(item.cv_path, item.cv_original_name);
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
