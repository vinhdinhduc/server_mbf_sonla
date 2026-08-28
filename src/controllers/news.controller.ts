import { Request, Response } from 'express';
import { newsService } from '../services/news.service';
import {
  createNewsSchema,
  listNewsQuerySchema,
  updateNewsSchema,
} from '../validators/news.validator';
import { sendCreated, sendSuccess } from '../utils/apiResponse';

export const newsController = {
  async listPublic(req: Request, res: Response) {
    const query = listNewsQuerySchema.parse(req.query);
    const result = await newsService.listPublic(query.category, query.page, query.page_size);
    sendSuccess(res, result);
  },

  async getPublicBySlug(req: Request, res: Response) {
    const news = await newsService.getPublicBySlug(req.params.slug);
    sendSuccess(res, news);
  },

  async listAdmin(_req: Request, res: Response) {
    const rows = await newsService.listAdmin();
    sendSuccess(res, rows);
  },

  async getById(req: Request, res: Response) {
    const news = await newsService.getById(Number(req.params.id));
    sendSuccess(res, news);
  },

  async create(req: Request, res: Response) {
    const dto = createNewsSchema.parse(req.body);
    const news = await newsService.create(dto, req.user!.id);
    req.auditContext = { module: 'news', action: 'create', targetId: news.id, newValue: dto };
    sendCreated(res, news, 'Tạo tin tức thành công');
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const dto = updateNewsSchema.parse(req.body);
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
