import express from 'express';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import stationRoutes from '../../src/routes/station.routes';
import { errorHandlerMiddleware } from '../../src/middlewares/errorHandler.middleware';
import { stationService } from '../../src/services/station.service';
import { User } from '../../src/models/User.model';

jest.mock('../../src/models/User.model', () => ({ User: { findByPk: jest.fn() } }));

jest.mock('../../src/config/env', () => ({
  env: { JWT_SECRET: 'station-test-secret', NODE_ENV: 'test' },
}));
jest.mock('../../src/services/station.service', () => ({
  stationService: {
    list: jest.fn(),
    get: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    nearest: jest.fn(),
  },
}));
jest.mock('../../src/middlewares/auditLogger.middleware', () => ({
  auditLogger: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../src/services/geocoding.service', () => ({
  nominatimProvider: { search: jest.fn() },
}));

describe('BTS API permissions and input boundaries', () => {
  let server: Server;
  let base: string;
  const token = (role: string) => {
    (User.findByPk as jest.Mock).mockResolvedValue({ id: 1, username: 'test', role, status: 'active', session_version: 0 });
    return jwt.sign({ id: 1, username: 'test', role }, 'station-test-secret');
  };
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/stations', stationRoutes);
    app.use(errorHandlerMiddleware);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/stations`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  it.each(['', 'chuyen_vien', 'giao_dich_vien', 'nhan_vien'])(
    'blocks unauthenticated/non-admin role %s on reads and writes',
    async (role) => {
      for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
        const response = await fetch(`${base}${['PUT', 'DELETE'].includes(method) ? '/1' : ''}`, {
          method,
          headers: role ? { Authorization: `Bearer ${token(role)}` } : {},
        });
        expect(response.status).toBe(role ? 403 : 401);
      }
      expect(stationService.list).not.toHaveBeenCalled();
      expect(stationService.save).not.toHaveBeenCalled();
    },
  );
  it('returns admin results with no-store and passes parsed filters', async () => {
    (stationService.list as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 500,
    });
    const response = await fetch(`${base}?status=active,warning&type=4G&search=SL`, {
      headers: { Authorization: `Bearer ${token('admin')}` },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(stationService.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: ['active', 'warning'], type: '4G', search: 'SL' }),
    );
  });
  it('rejects invalid ids and malformed writes before accessing storage', async () => {
    const headers = {
      Authorization: `Bearer ${token('admin')}`,
      'Content-Type': 'application/json',
    };
    expect((await fetch(`${base}/NaN`, { headers })).status).toBe(422);
    expect(
      (
        await fetch(base, {
          method: 'POST',
          headers,
          body: JSON.stringify({ code: 'SL-1', latitude: 100 }),
        })
      ).status,
    ).toBe(422);
    expect(stationService.get).not.toHaveBeenCalled();
    expect(stationService.save).not.toHaveBeenCalled();
  });
});
