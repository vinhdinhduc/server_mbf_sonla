import { Op } from 'sequelize';
import { Package } from '../models/Package.model';
import { AppError } from '../utils/AppError';
import { CreatePackageDto, UpdatePackageDto } from '../validators/package.validator';

export const packageService = {
  async listPublic(groupType: string | undefined) {
    const now = new Date();
    const where: Record<string, unknown> = {
      status: 'active',
      deleted_at: null,
      [Op.and]: [
        { [Op.or]: [{ effective_from: null }, { effective_from: { [Op.lte]: now } }] },
        { [Op.or]: [{ effective_to: null }, { effective_to: { [Op.gte]: now } }] },
      ],
    };
    if (groupType) where.group_type = groupType;
    return Package.findAll({ where, order: [['display_order', 'ASC']] });
  },

  async getPublicBySlug(slug: string) {
    const pkg = await Package.findOne({ where: { slug, status: 'active', deleted_at: null, [Op.and]: [{ [Op.or]: [{ effective_from: null }, { effective_from: { [Op.lte]: new Date() } }] }, { [Op.or]: [{ effective_to: null }, { effective_to: { [Op.gte]: new Date() } }] }] } });
    if (!pkg) throw AppError.notFound('Không tìm thấy gói cước');
    return pkg;
  },

  async listAdmin() {
    return Package.findAll({ where: { deleted_at: null }, order: [['display_order', 'ASC']] });
  },

  async getById(id: number) {
    const pkg = await Package.findOne({ where: { id, deleted_at: null } });
    if (!pkg) throw AppError.notFound('Không tìm thấy gói cước');
    return pkg;
  },

  async create(dto: CreatePackageDto) {
    const existing = await Package.findOne({ where: { code: dto.code } });
    if (existing) throw AppError.badRequest('Mã gói cước đã tồn tại');
    return Package.create(dto);
  },

  async update(id: number, dto: UpdatePackageDto) {
    const pkg = await this.getById(id);
    if (dto.code && dto.code !== pkg.code) {
      const existing = await Package.findOne({ where: { code: dto.code, id: { [Op.ne]: id } } });
      if (existing) throw AppError.badRequest('Mã gói cước đã tồn tại');
    }
    await pkg.update(dto);
    return pkg;
  },

  async remove(id: number) {
    const pkg = await this.getById(id);
    await pkg.update({ status: 'inactive', deleted_at: new Date() });
  },
};
