/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { utilityService } from '../services/utility.service';
import {
  downloadSchema,
  updateUtilitySchema,
  utilitySchema,
} from '../validators/utility.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';

export const utilityController = {
  async list(req: Request, res: Response) {
    sendSuccess(
      res,
      await utilityService.publicList(req.query.limit ? Number(req.query.limit) : undefined),
    );
  },
  async detail(req: Request, res: Response) {
    sendSuccess(res, await utilityService.publicDetail(req.params.slug));
  },
  async downloads(_q: Request, res: Response) {
    sendSuccess(res, await utilityService.downloads());
  },
  async track(req: Request, res: Response) {
    res.redirect(302, await utilityService.trackDownload(Number(req.params.id)));
  },
  async adminList(_q: Request, res: Response) {
    sendSuccess(res, await utilityService.adminList());
  },
  async get(req: Request, res: Response) {
    sendSuccess(res, await utilityService.get(Number(req.params.id)));
  },
  async create(req: Request, res: Response) {
    const dto = utilitySchema.parse({
      ...req.body,
      ...(req.file ? { card_image: `/uploads/${req.file.filename}` } : {}),
    });
    const item = await utilityService.create(dto);
    req.auditContext = { module: 'utilities', action: 'create', targetId: item.id, newValue: dto };
    sendCreated(res, item);
  },
  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateUtilitySchema.parse({
      ...req.body,
      ...(req.file ? { card_image: `/uploads/${req.file.filename}` } : {}),
    });
    const item = await utilityService.update(id, dto);
    req.auditContext = { module: 'utilities', action: 'update', targetId: id, newValue: dto };
    sendSuccess(res, item);
  },
  async remove(req: Request, res: Response) {
    await utilityService.remove(Number(req.params.id));
    sendSuccess(res, null);
  },
  async qr(req: Request, res: Response) {
    const format = req.query.format === 'svg' ? 'svg' : 'png';
    const data = await utilityService.qr(Number(req.params.id), req.params.platform as any, format);
    res.type(format === 'svg' ? 'image/svg+xml' : 'image/png').send(data);
  },
  async adminDownloads(_q: Request, res: Response) {
    sendSuccess(res, await utilityService.adminDownloads());
  },
  async createDownload(req: Request, res: Response) {
    sendCreated(res, await utilityService.createDownload(downloadSchema.parse(req.body)));
  },
  async updateDownload(req: Request, res: Response) {
    sendSuccess(
      res,
      await utilityService.updateDownload(
        Number(req.params.id),
        downloadSchema.partial().parse(req.body),
      ),
    );
  },
  async removeDownload(req: Request, res: Response) {
    await utilityService.removeDownload(Number(req.params.id));
    sendSuccess(res, null);
  },
};
