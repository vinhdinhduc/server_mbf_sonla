import { Store } from '../models/Store.model';
import { AppError } from '../utils/AppError';
import { CreateStoreDto, UpdateStoreDto } from '../validators/store.validator';

export const storeService = {
  async listPublic(district: string | undefined) {
    const where: Record<string, unknown> = {};
    if (district) where.district = district;
    return Store.findAll({ where, order: [['id', 'ASC']] });
  },

  async listAdmin() {
    return Store.findAll({ order: [['id', 'ASC']] });
  },

  async getById(id: number) {
    const store = await Store.findByPk(id);
    if (!store) throw AppError.notFound('Khong tim thay cua hang');
    return store;
  },

  async create(dto: CreateStoreDto) {
    return Store.create(dto);
  },

  async update(id: number, dto: UpdateStoreDto) {
    const store = await this.getById(id);
    await store.update(dto);
    return store;
  },

  async remove(id: number) {
    const store = await this.getById(id);
    await store.destroy();
  },
};
