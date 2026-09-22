import { AddressInfo } from 'net';
import { Server } from 'http';
import { app, sequelize } from '../../src/app';
import { invalidateRateConfig } from '../../src/services/rateLimit.service';

const isolated = process.env.E2E_DB_ISOLATED === '1' && process.env.DB_NAME === 'mobifone_sonla_e2e';
(isolated ? describe : describe.skip)('TC-27/28: rate limit behind one trusted proxy', () => {
  let server: Server; let base: string;
  beforeAll(async () => {
    app.set('trust proxy', 1);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    await sequelize.query("UPDATE rate_limit_policies SET max_requests=2,window_seconds=3600,block_seconds=60 WHERE `key`='contact'");
    invalidateRateConfig();
  });
  afterAll(async () => {
    await sequelize.query("UPDATE rate_limit_policies SET max_requests=5,window_seconds=3600,block_seconds=3600 WHERE `key`='contact'");
    invalidateRateConfig();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await sequelize.close();
  });
  const send = (ip: string) => fetch(`${base}/api/v1/public/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ name: 'E2E' }) });
  it('returns 429 and Retry-After on the third request; another IP remains independent', async () => {
    const ip = '198.51.100.251';
    expect((await send(ip)).status).not.toBe(429);
    expect((await send(ip)).status).not.toBe(429);
    const blocked = await send(ip);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(blocked.headers.get('x-ratelimit-limit')).toBe('2');
    expect((await send('198.51.100.252')).status).not.toBe(429);
  });
  it('allowlist bypasses the contact policy', async () => {
    await sequelize.query("INSERT INTO rate_limit_ip_rules(kind,cidr,reason,created_at) VALUES ('allow','198.51.100.251','e2e',NOW())");
    invalidateRateConfig();
    try { expect((await send('198.51.100.251')).status).not.toBe(429); }
    finally { await sequelize.query("DELETE FROM rate_limit_ip_rules WHERE cidr='198.51.100.251' AND reason='e2e'"); invalidateRateConfig(); }
  });
});
