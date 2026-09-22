import { sequelize } from '../../src/config/database';
import { consumeRateLimit, invalidateRateConfig, validateCidr } from '../../src/services/rateLimit.service';

jest.mock('../../src/config/database', () => ({ sequelize: { query: jest.fn() } }));
const query = sequelize.query as jest.Mock;
const policy = { key: 'contact', enabled: 1, max_requests: 2, window_seconds: 3600, block_seconds: 60, key_by: 'ip', message: 'Thử lại sau' };
beforeEach(() => { invalidateRateConfig(); query.mockReset(); query.mockImplementation(async (sql: string) => sql.includes('rate_limit_policies') ? [policy] : []); });

describe('M11 rate limit', () => {
  it('TC-27 blocks the third contact request and returns retry information', async () => {
    const ip = '198.51.100.11';
    expect((await consumeRateLimit('POST', '/api/v1/public/contacts', ip))?.blocked).toBe(false);
    expect((await consumeRateLimit('POST', '/api/v1/public/contacts', ip))?.blocked).toBe(false);
    const result = await consumeRateLimit('POST', '/api/v1/public/contacts', ip);
    expect(result).toMatchObject({ blocked: true, remaining: 0, message: 'Thử lại sau' });
    expect(result!.retryAfter).toBeGreaterThan(0);
  });
  it('TC-28 keeps IP counters separate', async () => {
    await consumeRateLimit('POST', '/api/v1/public/contacts', '198.51.100.21');
    await consumeRateLimit('POST', '/api/v1/public/contacts', '198.51.100.21');
    expect((await consumeRateLimit('POST', '/api/v1/public/contacts', '198.51.100.22'))?.blocked).toBe(false);
  });
  it('accepts CIDR and bypasses an allowed IP', async () => {
    expect(validateCidr('10.14.0.0/16').prefix).toBe(16);
    query.mockImplementation(async (sql: string) => sql.includes('rate_limit_policies') ? [policy] : sql.includes('rate_limit_ip_rules') ? [{ id: 1, kind: 'allow', cidr: '10.14.0.0/16', reason: null, expires_at: null }] : []);
    expect(await consumeRateLimit('POST', '/api/v1/public/contacts', '10.14.26.25')).toBeNull();
  });
});
