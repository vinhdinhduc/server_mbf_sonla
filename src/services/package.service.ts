import { Op } from 'sequelize';
import { Package } from '../models/Package.model';
import { AppError } from '../utils/AppError';
import { CreatePackageDto, UpdatePackageDto } from '../validators/package.validator';

export const packageService = {
  async listPublic(groupType: string | undefined) {
    const where: Record<string, unknown> = { status: 'active' };
    if (groupType) where.group_type = groupType;
    return Package.findAll({ where, order: [['display_order', 'ASC']] });
  },

  async getPublicBySlug(slug: string) {
    const pkg = await Package.findOne({ where: { slug, status: 'active' } });
    if (!pkg) throw AppError.notFound('Khong tim thay goi cuoc');
    return pkg;
  },

  async listAdmin() {
    return Package.findAll({ order: [['display_order', 'ASC']] });
  },

  async getById(id: number) {
    const pkg = await Package.findByPk(id);
    if (!pkg) throw AppError.notFound('Khong tim thay goi cuoc');
    return pkg;
  },

  async create(dto: CreatePackageDto) {
    const existing = await Package.findOne({ where: { code: dto.code } });
    if (existing) throw AppError.badRequest('Ma goi cuoc da ton tai');
    return Package.create(dto);
  },

  async update(id: number, dto: UpdatePackageDto) {
    const pkg = await this.getById(id);
    if (dto.code && dto.code !== pkg.code) {
      const existing = await Package.findOne({ where: { code: dto.code, id: { [Op.ne]: id } } });
      if (existing) throw AppError.badRequest('Ma goi cuoc da ton tai');
    }
    await pkg.update(dto);
    return pkg;
  },

  async remove(id: number) {
    const pkg = await this.getById(id);
    await pkg.destroy();
  },
};
