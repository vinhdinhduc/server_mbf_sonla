import { Op } from 'sequelize';
import { News } from '../models/News.model';
import { AppError } from '../utils/AppError';
import { CreateNewsDto, UpdateNewsDto } from '../validators/news.validator';
import { attachImageUrls } from '../utils/buildImageUrl';

export const newsService = {
  async listPublic(category: string | undefined, page: number, pageSize: number) {
    const where: Record<string, unknown> = { status: 'published' };
    if (category) where.category = category;

    const { rows, count } = await News.findAndCountAll({
      where,
      order: [['published_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return {
      items: rows.map((r) => attachImageUrls(r.toJSON(), ['thumbnail'])),
      total: count,
      page,
      page_size: pageSize,
    };
  },

  async getPublicBySlug(slug: string) {
    const news = await News.findOne({ where: { slug, status: 'published' } });
    if (!news) throw AppError.notFound('Không tìm thấy tin tức');
    return attachImageUrls(news.toJSON(), ['thumbnail']);
  },

  async listAdmin() {
    const rows = await News.findAll({ order: [['created_at', 'DESC']] });
    return rows.map((r) => attachImageUrls(r.toJSON(), ['thumbnail']));
  },

  async getById(id: number) {
    const news = await News.findByPk(id);
    if (!news) throw AppError.notFound('Không tìm thấy tin tức');
    return news;
  },

  async create(dto: CreateNewsDto, authorId: number) {
    const existingSlug = await News.findOne({ where: { slug: dto.slug } });
    if (existingSlug) throw AppError.badRequest('Đường dẫn đã tồn tại');

    const news = await News.create({
      ...dto,
      author_id: authorId,
      published_at: dto.status === 'published' ? (dto.published_at ?? new Date()) : null,
    });
    return news;
  },

  async update(id: number, dto: UpdateNewsDto) {
    const news = await this.getById(id);

    if (dto.slug && dto.slug !== news.slug) {
      const existingSlug = await News.findOne({ where: { slug: dto.slug, id: { [Op.ne]: id } } });
      if (existingSlug) throw AppError.badRequest('Đường dẫn đã tồn tại');
    }

    const publishTransition = dto.status === 'published' && news.status !== 'published';

    await news.update({
      ...dto,
      published_at: publishTransition ? new Date() : (dto.published_at ?? news.published_at),
    });
    return news;
  },

  async remove(id: number) {
    const news = await this.getById(id);
    await news.destroy();
  },
};
