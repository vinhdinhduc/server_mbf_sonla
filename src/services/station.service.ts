import { Op, UniqueConstraintError, WhereOptions } from 'sequelize';
import { z } from 'zod';
import { Station } from '../models/Station.model';
import { stationQuerySchema, stationSchema } from '../validators/station.validator';
import { AppError } from '../utils/AppError';
import { haversineKm } from '../utils/stationDistance';

export function stationWhere(query: z.infer<typeof stationQuerySchema>): WhereOptions {
  const where: WhereOptions[] = [];
  if (query.status) where.push({ status: { [Op.in]: query.status } });
  if (query.type) where.push({ type: query.type });
  if (query.search) {
    const term = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
    where.push({ [Op.or]: [{ code: { [Op.like]: term } }, { name: { [Op.like]: term } }] });
  }
  if (query.bbox) {
    const [west, south, east, north] = query.bbox;
    where.push({
      latitude: { [Op.between]: [south, north] },
      longitude: { [Op.between]: [west, east] },
    });
  }
  return { [Op.and]: where };
}

export const stationService = {
  async list(query: z.infer<typeof stationQuerySchema>) {
    const { rows, count } = await Station.findAndCountAll({
      where: stationWhere(query),
      order: [['id', 'ASC']],
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    });
    return { items: rows, total: count, page: query.page, limit: query.limit };
  },
  async get(id: number) {
    const station = await Station.findByPk(id);
    if (!station) throw AppError.notFound('Không tìm thấy trạm BTS');
    return station;
  },
  async save(dto: z.infer<typeof stationSchema>, id?: number) {
    try {
      if (id !== undefined) return await (await this.get(id)).update(dto);
      return await Station.create(dto);
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw AppError.conflict('Mã trạm đã tồn tại');
      throw error;
    }
  },
  async remove(id: number) {
    const station = await this.get(id);
    const previous = station.toJSON();
    await station.destroy();
    return previous;
  },
  async nearest(latitude: number, longitude: number, limit: number) {
    // Search all stations, independently of map filters and viewport.
    const rows = await Station.findAll();
    return rows
      .map((station) => ({
        ...station.toJSON(),
        distance_km: haversineKm(latitude, longitude, station.latitude, station.longitude),
      }))
      .sort((a, b) => a.distance_km - b.distance_km || a.id - b.id)
      .slice(0, limit);
  },
};
