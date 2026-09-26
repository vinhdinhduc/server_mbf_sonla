/* eslint-disable no-restricted-syntax, no-await-in-loop */
import { createHash, randomBytes } from 'crypto';
import { Op, QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { News } from '../models/News.model';
import { AppError } from '../utils/AppError';
import { CreateNewsDto, UpdateNewsDto } from '../validators/news.validator';
import { attachImageUrls } from '../utils/buildImageUrl';
import { sanitizeContent } from '../utils/sanitizeContent';

type ListFilters = {
  category?: string;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  author_id?: number;
  featured?: boolean;
  page: number;
  page_size: number;
};
const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
const publicWhere = () => ({ status: 'published', published_at: { [Op.lte]: new Date() } });
const present = (row: News) =>
  attachImageUrls(row.toJSON(), ['thumbnail', 'cover_url', 'og_image_url']);

async function syncTags(newsId: number, tags: string[] | undefined, transaction: Transaction) {
  if (!tags) return;
  await sequelize.query('DELETE FROM news_tag_map WHERE news_id=:newsId', {
    replacements: { newsId },
    transaction,
  });
  for (const raw of [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]) {
    const slug = normalizeSearch(raw)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 100);
    await sequelize.query(
      'INSERT INTO news_tags(name,slug,created_at,updated_at) VALUES (:name,:slug,NOW(),NOW()) ON DUPLICATE KEY UPDATE name=VALUES(name)',
      { replacements: { name: raw.slice(0, 80), slug }, transaction },
    );
    const ids = await sequelize.query<{ id: number }>('SELECT id FROM news_tags WHERE slug=:slug', {
      replacements: { slug },
      type: QueryTypes.SELECT,
      transaction,
    });
    await sequelize.query(
      'INSERT IGNORE INTO news_tag_map(news_id,tag_id) VALUES (:newsId,:tagId)',
      { replacements: { newsId, tagId: ids[0].id }, transaction },
    );
  }
}

async function tagsFor(ids: number[]) {
  if (!ids.length) return new Map<number, string[]>();
  const rows = await sequelize.query<{ news_id: number; name: string }>(
    'SELECT m.news_id,t.name FROM news_tag_map m JOIN news_tags t ON t.id=m.tag_id WHERE m.news_id IN (:ids) ORDER BY t.name',
    { replacements: { ids }, type: QueryTypes.SELECT },
  );
  const map = new Map<number, string[]>();
  for (const row of rows) map.set(row.news_id, [...(map.get(row.news_id) || []), row.name]);
  return map;
}

export const newsService = {
  async listPublic(filters: ListFilters) {
    const where: Record<string | symbol, unknown> = publicWhere();
    if (filters.category) where.category = filters.category;
    if (filters.search)
      where[Op.or] = [
        { title: { [Op.like]: `%${filters.search}%` } },
        { summary: { [Op.like]: `%${filters.search}%` } },
      ];
    const { rows, count } = await News.findAndCountAll({
      where,
      order: [
        ['is_pinned', 'DESC'],
        ['published_at', 'DESC'],
      ],
      limit: filters.page_size,
      offset: (filters.page - 1) * filters.page_size,
    });
    const tagMap = await tagsFor(rows.map((row) => row.id));
    return {
      items: rows.map((row) => ({ ...present(row), tags: tagMap.get(row.id) || [] })),
      total: count,
      page: filters.page,
      page_size: filters.page_size,
    };
  },
  async featured() {
    const rows = await News.findAll({
      where: { ...publicWhere(), is_featured: true },
      order: [['published_at', 'DESC']],
      limit: 3,
    });
    return rows.map(present);
  },
  async getPublicBySlug(slug: string) {
    const news = await News.findOne({ where: { slug, ...publicWhere() } });
    if (!news) {
      const history = await sequelize.query<{ slug: string }>(
        'SELECT n.slug FROM news_slug_history h JOIN news n ON n.id=h.news_id WHERE h.old_slug=:slug AND n.status="published" AND n.deleted_at IS NULL LIMIT 1',
        { replacements: { slug }, type: QueryTypes.SELECT },
      );
      if (history[0]) return { redirect: history[0].slug };
      throw AppError.notFound('Không tìm thấy tin tức');
    }
    const related = await News.findAll({
      where: { ...publicWhere(), id: { [Op.ne]: news.id }, category: news.category },
      order: [['published_at', 'DESC']],
      limit: 3,
    });
    const author = news.author_id
      ? (
          await sequelize.query<{ full_name: string }>('SELECT full_name FROM users WHERE id=:id', {
            replacements: { id: news.author_id },
            type: QueryTypes.SELECT,
          })
        )[0]
      : null;
    return {
      ...present(news),
      author_name: author?.full_name || null,
      tags: (await tagsFor([news.id])).get(news.id) || [],
      related: related.map(present),
    };
  },
  async preview(token: string) {
    const news = await News.findOne({ where: { preview_token: token } });
    if (!news) throw AppError.notFound('Liên kết xem trước không hợp lệ');
    return present(news);
  },
  async countView(slug: string, visitor: string, userAgent = '') {
    if (/bot|crawler|spider|preview/i.test(userAgent)) return;
    const news = await News.findOne({ where: { slug, ...publicWhere() }, attributes: ['id'] });
    if (!news) return;
    const visitorHash = createHash('sha256').update(visitor).digest('hex');
    const recent = await sequelize.query(
      'SELECT id FROM news_views WHERE news_id=:id AND visitor_hash=:visitor AND viewed_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE) LIMIT 1',
      { replacements: { id: news.id, visitor: visitorHash }, type: QueryTypes.SELECT },
    );
    if (recent.length) return;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(
        'INSERT INTO news_views(news_id,visitor_hash,viewed_at) VALUES (:id,:visitor,NOW())',
        { replacements: { id: news.id, visitor: visitorHash }, transaction },
      );
      await news.increment('view_count', { transaction });
    });
  },
  async listAdmin(filters: ListFilters) {
    const where: Record<string | symbol, unknown> = {};
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.author_id) where.author_id = filters.author_id;
    if (filters.featured !== undefined) where.is_featured = filters.featured;
    if (filters.search)
      where[Op.or] = [
        { title: { [Op.like]: `%${filters.search}%` } },
        { slug: { [Op.like]: `%${filters.search}%` } },
      ];
    if (filters.from || filters.to)
      where.created_at = {
        ...(filters.from ? { [Op.gte]: new Date(`${filters.from}T00:00:00+07:00`) } : {}),
        ...(filters.to ? { [Op.lte]: new Date(`${filters.to}T23:59:59+07:00`) } : {}),
      };
    const { rows, count } = await News.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: filters.page_size,
      offset: (filters.page - 1) * filters.page_size,
    });
    return {
      items: rows.map(present),
      total: count,
      page: filters.page,
      page_size: filters.page_size,
    };
  },
  async getById(id: number) {
    const news = await News.findByPk(id);
    if (!news) throw AppError.notFound('Không tìm thấy tin tức');
    return { ...present(news), tags: (await tagsFor([id])).get(id) || [] };
  },
  async create(dto: CreateNewsDto, authorId: number) {
    if (await News.findOne({ where: { slug: dto.slug }, paranoid: false }))
      throw AppError.conflict('Đường dẫn đã tồn tại');
    if (
      dto.is_featured &&
      (await News.count({ where: { is_featured: true, status: 'published' } })) >= 3
    )
      throw AppError.conflict('Chỉ được chọn tối đa 3 tin nổi bật; hãy bỏ chọn một tin cũ');
    return sequelize.transaction(async (transaction) => {
      const { tags, ...values } = dto;
      const content = sanitizeContent(values.content);
      const news = await News.create(
        {
          ...values,
          content,
          cover_url: values.cover_url || values.thumbnail || null,
          author_id: authorId,
          preview_token: randomBytes(24).toString('hex'),
          search_text: normalizeSearch(`${values.title} ${values.summary || ''}`),
          published_at:
            values.status === 'published'
              ? (values.published_at ?? new Date())
              : (values.published_at ?? null),
        },
        { transaction },
      );
      await syncTags(news.id, tags, transaction);
      return news;
    });
  },
  async update(id: number, dto: UpdateNewsDto) {
    const news = await News.findByPk(id);
    if (!news) throw AppError.notFound('Không tìm thấy tin tức');
    if (
      dto.slug &&
      dto.slug !== news.slug &&
      (await News.findOne({ where: { slug: dto.slug, id: { [Op.ne]: id } }, paranoid: false }))
    )
      throw AppError.conflict('Đường dẫn đã tồn tại');
    if (
      dto.is_featured &&
      !news.is_featured &&
      (await News.count({
        where: { is_featured: true, status: 'published', id: { [Op.ne]: id } },
      })) >= 3
    )
      throw AppError.conflict('Chỉ được chọn tối đa 3 tin nổi bật; hãy bỏ chọn một tin cũ');
    await sequelize.transaction(async (transaction) => {
      const { tags, ...values } = dto;
      if (values.slug && values.slug !== news.slug && news.status === 'published')
        await sequelize.query(
          'INSERT IGNORE INTO news_slug_history(news_id,old_slug,created_at) VALUES (:id,:slug,NOW())',
          { replacements: { id, slug: news.slug }, transaction },
        );
      if (values.content !== undefined) values.content = sanitizeContent(values.content);
      const publishedAt =
        values.status === 'published' && news.status !== 'published'
          ? values.published_at || new Date()
          : values.published_at;
      await news.update(
        {
          ...values,
          ...(values.thumbnail ? { cover_url: values.cover_url || values.thumbnail } : {}),
          ...(values.title || values.summary !== undefined
            ? {
                search_text: normalizeSearch(
                  `${values.title || news.title} ${values.summary ?? news.summary ?? ''}`,
                ),
              }
            : {}),
          ...(publishedAt !== undefined ? { published_at: publishedAt } : {}),
        },
        { transaction },
      );
      await syncTags(id, tags, transaction);
    });
    return this.getById(id);
  },
  async autosave(id: number, content: string) {
    const news = await News.findByPk(id);
    if (!news) throw AppError.notFound('Không tìm thấy tin tức');
    await news.update({ autosave_content: sanitizeContent(content) });
    return { saved_at: new Date() };
  },
  async duplicate(id: number, authorId: number) {
    const source = await News.findByPk(id);
    if (!source) throw AppError.notFound('Không tìm thấy tin tức');
    const values = source.toJSON() as Record<string, unknown>;
    delete values.id;
    delete values.created_at;
    delete values.updated_at;
    delete values.deleted_at;
    return News.create({
      ...values,
      title: `${source.title} (Bản sao)`,
      slug: `${source.slug}-ban-sao-${Date.now().toString().slice(-6)}`,
      status: 'draft',
      is_featured: false,
      published_at: null,
      view_count: 0,
      author_id: authorId,
      preview_token: randomBytes(24).toString('hex'),
    } as never);
  },
  async publishScheduled() {
    return News.update(
      { status: 'published' },
      { where: { status: 'scheduled', published_at: { [Op.lte]: new Date() } } },
    );
  },
  async remove(id: number) {
    const news = await News.findByPk(id);
    if (!news) throw AppError.notFound('Không tìm thấy tin tức');
    await news.destroy();
  },
};
