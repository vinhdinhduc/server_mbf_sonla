import { sequelize } from '../../src/config/database';
import { initStationModel, Station } from '../../src/models/Station.model';
import { stationWhere } from '../../src/services/station.service';
import { stationQuerySchema, stationSchema } from '../../src/validators/station.validator';

// Explicit opt-in; every write is enclosed in a transaction rolled back in finally.
(process.env.STATION_DB_TEST === '1' ? describe : describe.skip)(
  'stations MySQL migration and model',
  () => {
    beforeAll(() => {
      initStationModel(sequelize);
    });
    afterAll(async () => {
      await sequelize.close();
    });
    it('round-trips all fields, filters coordinates and enforces unique codes', async () => {
      const transaction = await sequelize.transaction();
      try {
        const input = stationSchema.parse({
          code: `TEST-BTS-${Date.now()}`,
          name: 'Kiểm thử rollback',
          address: 'Sơn La',
          latitude: 21.3256,
          longitude: 103.9188,
          type: '5G',
          status: 'active',
          power_watts: 42.5,
          coverage_radius_m: 1500,
          installed_at: '2024-02-29',
          notes: 'Dữ liệu kiểm thử trong transaction',
        });
        const row = await Station.create(input, { transaction });
        const loaded = await Station.findByPk(row.id, { transaction });
        expect(loaded?.toJSON()).toMatchObject(input);
        const query = stationQuerySchema.parse({
          search: input.code,
          status: 'active,warning',
          type: '5G',
          bbox: '103,20,105,23',
        });
        expect(await Station.count({ where: stationWhere(query), transaction })).toBe(1);
        await expect(Station.create(input, { transaction })).rejects.toMatchObject({
          name: 'SequelizeUniqueConstraintError',
        });
        await row.update({ status: 'maintenance' }, { transaction });
        expect(await Station.count({ where: stationWhere(query), transaction })).toBe(0);
        await row.destroy({ transaction });
        expect(await Station.findByPk(row.id, { transaction })).toBeNull();
      } finally {
        await transaction.rollback();
      }
    });
  },
);
