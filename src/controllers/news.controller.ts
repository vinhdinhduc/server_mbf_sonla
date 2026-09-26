import { Request, Response } from 'express';
import { newsService } from '../services/news.service';
import {
  createNewsSchema,
  listNewsQuerySchema,
  updateNewsSchema,
  autosaveNewsSchema,
} from '../validators/news.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';

export const newsController = {
  async listPublic(req: Request, res: Response) {
    const query = listNewsQuerySchema.parse(req.query);
    const result = await newsService.listPublic(query);
    sendSuccess(res, result);
  },

  async getPublicBySlug(req: Request, res: Response) {
    const news = await newsService.getPublicBySlug(req.params.slug);
    sendSuccess(res, news);
  },

  async featured(_req: Request, res: Response) {
    sendSuccess(res, await newsService.featured());
  },
  async preview(req: Request, res: Response) {
    sendSuccess(res, await newsService.preview(String(req.params.token)));
  },
  async view(req: Request, res: Response) {
    await newsService.countView(
      req.params.slug,
      String(req.body.visitor_id || req.ip),
      req.get('user-agent') || '',
    );
    sendSuccess(res, null);
  },

  async listAdmin(req: Request, res: Response) {
    const rows = await newsService.listAdmin(listNewsQuerySchema.parse(req.query));
    sendSuccess(res, rows);
  },

  async autosave(req: Request, res: Response) {
    sendSuccess(
      res,
      await newsService.autosave(Number(req.params.id), autosaveNewsSchema.parse(req.body).content),
    );
  },
  async duplicate(req: Request, res: Response) {
    sendCreated(
      res,
      await newsService.duplicate(Number(req.params.id), req.user!.id),
      'Đã nhân bản tin',
    );
  },

  async getById(req: Request, res: Response) {
    const news = await newsService.getById(Number(req.params.id));
    sendSuccess(res, news);
  },

  async create(req: Request, res: Response) {
    const dto = createNewsSchema.parse({
      ...req.body,
      ...(req.file ? { thumbnail: `/uploads/${req.file.filename}` } : {}),
    });
    const news = await newsService.create(dto, req.user!.id);
    req.auditContext = { module: 'news', action: 'create', targetId: news.id, newValue: dto };
    sendCreated(res, news, 'Tạo tin tức thành công');
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateNewsSchema.parse({
      ...req.body,
      ...(req.file ? { thumbnail: `/uploads/${req.file.filename}` } : {}),
    });
    const news = await newsService.update(id, dto);
    req.auditContext = { module: 'news', action: 'update', targetId: id, newValue: dto };
    sendSuccess(res, news, 'Cập nhật tin tức thành công');
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    await newsService.remove(id);
    req.auditContext = { module: 'news', action: 'delete', targetId: id };
    sendSuccess(res, null, 'Xóa tin tức thành công');
  },
};
