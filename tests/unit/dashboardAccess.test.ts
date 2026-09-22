import { User } from '../../src/models/User.model';
import { dashboardService } from '../../src/services/dashboard.service';

jest.mock('../../src/config/database', () => ({ sequelize: { query: jest.fn() } }));
jest.mock('../../src/models/User.model', () => ({ User: { findByPk: jest.fn() } }));

describe('TC-37: teller dashboard scope', () => {
  it('rejects another store before any aggregation query', async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({ store_id: 7 });
    await expect(dashboardService.get({ id: 4, username: 'teller', role: 'giao_dich_vien' }, '2026-09-01', '2026-09-07', 8)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('rejects invalid calendar dates and store ids before querying', async () => {
    const admin = { id: 1, username: 'admin', role: 'admin' as const };
    await expect(dashboardService.get(admin, '2026-02-31', '2026-03-01')).rejects.toMatchObject({ statusCode: 400 });
    await expect(dashboardService.get(admin, '2026-01-01', '2026-01-02', NaN)).rejects.toMatchObject({ statusCode: 400 });
  });
});
