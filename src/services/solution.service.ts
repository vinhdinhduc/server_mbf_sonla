import { Op } from 'sequelize';
import { Solution } from '../models/Solution.model';
import { AppError } from '../utils/AppError';
import { CreateSolutionDto, UpdateSolutionDto } from '../validators/solution.validator';
import { attachImageUrls } from '../utils/buildImageUrl';

export const solutionService = {
  async listPublic(category: string | undefined) {
    const where: Record<string, unknown> = { status: 'active' };
    if (category) where.category = category;
    const rows = await Solution.findAll({
      where,
      order: [
        ['is_hot', 'DESC'],
        ['id', 'DESC'],
      ],
    });
    return rows.map((r) => attachImageUrls(r.toJSON(), ['thumbnail']));
  },

  async getPublicBySlug(slug: string) {
    const sol = await Solution.findOne({ where: { slug, status: 'active' } });
    if (!sol) throw AppError.notFound('Khong tim thay giai phap');
    return attachImageUrls(sol.toJSON(), ['thumbnail']);
  },

  async listAdmin() {
    return Solution.findAll({ order: [['id', 'DESC']] });
  },

  async getById(id: number) {
    const sol = await Solution.findByPk(id);
    if (!sol) throw AppError.notFound('Khong tim thay giai phap');
    return sol;
  },

  async create(dto: CreateSolutionDto) {
    const existing = await Solution.findOne({ where: { slug: dto.slug } });
    if (existing) throw AppError.badRequest('Slug da ton tai');
    return Solution.create(dto);
  },

  async update(id: number, dto: UpdateSolutionDto) {
    const sol = await this.getById(id);
    if (dto.slug && dto.slug !== sol.slug) {
      const existing = await Solution.findOne({ where: { slug: dto.slug, id: { [Op.ne]: id } } });
      if (existing) throw AppError.badRequest('Slug da ton tai');
    }
    await sol.update(dto);
    return sol;
  },

  async remove(id: number) {
    const sol = await this.getById(id);
    await sol.destroy();
  },
};
