import { Op } from 'sequelize';
import { Package } from '../models/Package.model';
import { RegistrationItem } from '../models/RegistrationItem.model';
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
    const pkg = await Package.findOne({
      where: {
        slug,
        status: 'active',
        deleted_at: null,
        [Op.and]: [
          { [Op.or]: [{ effective_from: null }, { effective_from: { [Op.lte]: new Date() } }] },
          { [Op.or]: [{ effective_to: null }, { effective_to: { [Op.gte]: new Date() } }] },
        ],
      },
    });
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
    this.validateRegistrationSyntax(dto.status, dto.registerSyntax, dto.registerShortcode);
    const existing = await Package.findOne({ where: { code: dto.code } });
    if (existing) throw AppError.badRequest('Mã gói cước đã tồn tại');
    return Package.create(dto);
  },

  async update(id: number, dto: UpdatePackageDto) {
    const pkg = await this.getById(id);
    this.validateRegistrationSyntax(
      dto.status ?? pkg.status,
      dto.registerSyntax !== undefined ? dto.registerSyntax : pkg.registerSyntax,
      dto.registerShortcode !== undefined ? dto.registerShortcode : pkg.registerShortcode,
    );
    if (dto.code && dto.code !== pkg.code) {
      const existing = await Package.findOne({ where: { code: dto.code, id: { [Op.ne]: id } } });
      if (existing) throw AppError.badRequest('Mã gói cước đã tồn tại');
    }
    await pkg.update(dto);
    return pkg;
  },

  async remove(id: number) {
    const pkg = await this.getById(id);
    const references = await RegistrationItem.count({
      where: { type: 'goi_cuoc', reference_id: id },
      distinct: true,
      col: 'registration_group_id',
    });
    if (references)
      throw AppError.badRequest(
        `Gói này có ${references} đăng ký. Chuyển sang Ngừng bán để giữ lịch sử đăng ký.`,
      );
    await pkg.update({ status: 'inactive', deleted_at: new Date() });
  },

  validateRegistrationSyntax(
    status: string | undefined,
    registerSyntax: string | null | undefined,
    registerShortcode: string | null | undefined,
  ) {
    if (status === 'active' && (!registerSyntax?.trim() || !registerShortcode?.trim())) {
      throw AppError.badRequest('Gói đang bán cần có cú pháp đăng ký và số tổng đài');
    }
  },
};
