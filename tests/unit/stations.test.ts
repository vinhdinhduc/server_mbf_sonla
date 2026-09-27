import { Op, UniqueConstraintError } from 'sequelize';
import { Station } from '../../src/models/Station.model';
import { stationService, stationWhere } from '../../src/services/station.service';
import { stationSchema, stationQuerySchema } from '../../src/validators/station.validator';
import { haversineKm } from '../../src/utils/stationDistance';

jest.mock('../../src/models/Station.model', () => ({
  Station: {
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
}));

const valid = {
  code: 'SL-001',
  name: 'Trạm Sơn La',
  address: 'Sơn La',
  latitude: 21.3256,
  longitude: 103.9188,
  type: '4G',
  status: 'active',
  installed_at: '2024-02-29',
};

describe('Station validation and spatial queries', () => {
  it('accepts optional nullable fields and leap dates', () => {
    expect(stationSchema.parse(valid)).toMatchObject({
      power_watts: null,
      notes: null,
      coverage_radius_m: null,
    });
  });
  it.each([
    { latitude: 91 },
    { longitude: -181 },
    { latitude: '' },
    { latitude: null },
    { power_watts: -1 },
    { coverage_radius_m: 0 },
    { coverage_radius_m: 2.5 },
    { installed_at: '2025-02-29' },
    { status: 'unknown' },
    { type: '6G' },
    { code: '' },
  ])('rejects invalid station fields %p', (patch) => {
    expect(stationSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
  it('validates multiple status filters, bbox and pagination', () => {
    const query = stationQuerySchema.parse({
      status: 'active,warning',
      bbox: '103,20,105,23',
      page: '2',
      limit: '50',
    });
    expect(query.status).toEqual(['active', 'warning']);
    expect(stationWhere(query)).toEqual({
      [Op.and]: [
        { status: { [Op.in]: ['active', 'warning'] } },
        { latitude: { [Op.between]: [20, 23] }, longitude: { [Op.between]: [103, 105] } },
      ],
    });
    for (const input of [
      { bbox: '105,20,103,23' },
      { bbox: '1,2,3' },
      { bbox: ',,3,4' },
      { limit: '1001' },
      { page: '0' },
      { status: 'active,invalid' },
    ]) {
      expect(stationQuerySchema.safeParse(input).success).toBe(false);
    }
  });
  it('treats SQL wildcard characters in search as literals', () => {
    const where = stationWhere(stationQuerySchema.parse({ search: 'SL_10%' }));
    expect(where).toEqual({
      [Op.and]: [
        {
          [Op.or]: [
            { code: { [Op.like]: '%SL\\_10\\%%' } },
            { name: { [Op.like]: '%SL\\_10\\%%' } },
          ],
        },
      ],
    });
  });
  it('applies pagination without silently discarding total count', async () => {
    (Station.findAndCountAll as jest.Mock).mockResolvedValue({ rows: [], count: 1300 });
    expect(
      await stationService.list(stationQuerySchema.parse({ page: '2', limit: '1000' })),
    ).toMatchObject({ total: 1300, page: 2, limit: 1000 });
    expect(Station.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 1000, limit: 1000 }),
    );
  });
  it('computes great-circle distance and sorts all stations independently of filters', async () => {
    expect(haversineKm(0, 0, 0, 0)).toBe(0);
    expect(haversineKm(0, 0, 0, 1)).toBeCloseTo(111.195, 2);
    expect(Number.isFinite(haversineKm(90, 180, -90, 0))).toBe(true);
    (Station.findAll as jest.Mock).mockResolvedValue(
      [3, 1, 2].map((id) => ({
        latitude: 0,
        longitude: id,
        toJSON: () => ({ id, status: 'incident' }),
      })),
    );
    const result = await stationService.nearest(0, 0, 2);
    expect(result.map((station) => station.id)).toEqual([1, 2]);
    expect(Station.findAll).toHaveBeenCalledWith();
  });
  it('reports missing rows and duplicate station codes', async () => {
    (Station.findByPk as jest.Mock).mockResolvedValue(null);
    await expect(stationService.get(123)).rejects.toMatchObject({ statusCode: 404 });
    (Station.create as jest.Mock).mockRejectedValue(
      new UniqueConstraintError({ message: 'duplicate' }),
    );
    await expect(stationService.save(stationSchema.parse(valid))).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
