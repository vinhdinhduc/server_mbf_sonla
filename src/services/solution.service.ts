import { Op } from 'sequelize';
import { Solution } from '../models/Solution.model';
import { SolutionFeature } from '../models/SolutionFeature.model';
import { SolutionPricing } from '../models/SolutionPricing.model';
import { SolutionFaq } from '../models/SolutionFaq.model';
import { SolutionGallery } from '../models/SolutionGallery.model';
import { AppError } from '../utils/AppError';
import { CreateSolutionDto, UpdateSolutionDto } from '../validators/solution.validator';
import { attachImageUrls } from '../utils/buildImageUrl';
import { sequelize } from '../config/database';

export const solutionService = {
  async listPublic(query: {
    category?: string;
    is_hot?: boolean;
    page?: number;
    page_size?: number;
  }) {
    const where: Record<string, unknown> = { status: 'active' };
    if (query.category) where.category = query.category;
    if (query.is_hot !== undefined) where.is_hot = query.is_hot;
    const pagination = query.page !== undefined || query.page_size !== undefined;
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 12;
    const rows = await Solution.findAll({
      where,
      order: [
        ['is_hot', 'DESC'],
        ['id', 'DESC'],
      ],
      ...(pagination ? { limit: pageSize, offset: (page - 1) * pageSize } : {}),
    });
    const items = rows.map((r) => attachImageUrls(r.toJSON(), ['thumbnail']));
    if (!pagination) return items;
    const total = await Solution.count({ where });
    return { items, total, page, page_size: pageSize };
  },

  async getPublicBySlug(slug: string) {
    const sol = await Solution.findOne({
      where: { slug, status: 'active' },
      include: [
        { model: SolutionFeature, as: 'features', separate: true, order: [['sort_order', 'ASC']] },
        { model: SolutionPricing, as: 'pricing', separate: true, order: [['sort_order', 'ASC']] },
        { model: SolutionFaq, as: 'faqs', separate: true, order: [['sort_order', 'ASC']] },
        { model: SolutionGallery, as: 'gallery', separate: true, order: [['sort_order', 'ASC']] },
      ],
    });
    if (!sol) throw AppError.notFound('Không tìm thấy giải pháp');
    const result = sol.toJSON() as Record<string, any>;
    result.gallery = (result.gallery ?? []).map((item: Record<string, any>) =>
      attachImageUrls(item, ['image_url']),
    );
    return attachImageUrls(result, ['thumbnail']);
  },

  async listAdmin() {
    return Solution.findAll({ order: [['id', 'DESC']] });
  },

  async getById(id: number) {
    const sol = await Solution.findByPk(id, {
      include: [
        { model: SolutionFeature, as: 'features', separate: true, order: [['sort_order', 'ASC']] },
        { model: SolutionPricing, as: 'pricing', separate: true, order: [['sort_order', 'ASC']] },
        { model: SolutionFaq, as: 'faqs', separate: true, order: [['sort_order', 'ASC']] },
        { model: SolutionGallery, as: 'gallery', separate: true, order: [['sort_order', 'ASC']] },
      ],
    });
    if (!sol) throw AppError.notFound('Không tìm thấy giải pháp');
    return sol;
  },

  async create(dto: CreateSolutionDto) {
    const existing = await Solution.findOne({ where: { slug: dto.slug } });
    if (existing) throw AppError.badRequest('Slug da ton tai');
    const { features, pricing, faqs, gallery, ...solutionData } = dto;
    return sequelize.transaction(async (transaction) => {
      const sol = await Solution.create(solutionData, { transaction });
      await this.replaceDetails(sol.id, { features, pricing, faqs, gallery }, transaction);
      return sol;
    });
  },

  async update(id: number, dto: UpdateSolutionDto) {
    const sol = await this.getById(id);
    if (dto.slug && dto.slug !== sol.slug) {
      const existing = await Solution.findOne({ where: { slug: dto.slug, id: { [Op.ne]: id } } });
      if (existing) throw AppError.badRequest('Slug da ton tai');
    }
    const { features, pricing, faqs, gallery, ...solutionData } = dto;
    await sequelize.transaction(async (transaction) => {
      await sol.update(solutionData, { transaction });
      await this.replaceDetails(id, { features, pricing, faqs, gallery }, transaction);
    });
    return this.getById(id);
  },

  async remove(id: number) {
    const sol = await this.getById(id);
    await sol.destroy();
  },

  async replaceDetails(
    solutionId: number,
    details: Pick<CreateSolutionDto, 'features' | 'pricing' | 'faqs' | 'gallery'>,
    transaction: any,
  ) {
    if (details.features !== undefined) {
      await SolutionFeature.destroy({ where: { solution_id: solutionId }, transaction });
      await SolutionFeature.bulkCreate(details.features.map((item, index) => ({ ...item, solution_id: solutionId, sort_order: item.sort_order ?? index })), { transaction });
    }
    if (details.pricing !== undefined) {
      await SolutionPricing.destroy({ where: { solution_id: solutionId }, transaction });
      await SolutionPricing.bulkCreate(details.pricing.map((item, index) => ({ ...item, solution_id: solutionId, sort_order: item.sort_order ?? index })), { transaction });
    }
    if (details.faqs !== undefined) {
      await SolutionFaq.destroy({ where: { solution_id: solutionId }, transaction });
      await SolutionFaq.bulkCreate(details.faqs.map((item, index) => ({ ...item, solution_id: solutionId, sort_order: item.sort_order ?? index })), { transaction });
    }
    if (details.gallery !== undefined) {
      await SolutionGallery.destroy({ where: { solution_id: solutionId }, transaction });
      await SolutionGallery.bulkCreate(details.gallery.map((item, index) => ({ ...item, solution_id: solutionId, sort_order: item.sort_order ?? index })), { transaction });
    }
  },
};
