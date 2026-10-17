import express from 'express';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { adminPromotionRoutes, publicPromotionRoutes } from '../../src/routes/promotion.routes';
import { authMiddleware } from '../../src/middlewares/auth.middleware';
import { errorHandlerMiddleware } from '../../src/middlewares/errorHandler.middleware';
import { promotionService } from '../../src/services/promotion.service';
import { AuditLog } from '../../src/models/AuditLog.model';
import { User } from '../../src/models/User.model';

jest.mock('../../src/models/User.model', () => ({ User: { findByPk: jest.fn() } }));
jest.mock('../../src/models/AuditLog.model', () => ({ AuditLog: { create: jest.fn().mockResolvedValue({}) } }));
jest.mock('../../src/config/env', () => ({ env: { JWT_SECRET: 'promotion-test-secret', NODE_ENV: 'test' } }));
jest.mock('../../src/services/promotion.service', () => ({
  promotionService: { list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn(), listPublic: jest.fn(), recordEvent: jest.fn() },
}));

describe('promotion API permissions, parsing and audit', () => {
  let server: Server;
  let base: string;
  const token = (role: string) => {
    (User.findByPk as jest.Mock).mockResolvedValue({ id: 3, username: 'admin-test', role, status: 'active', session_version: 0 });
    return jwt.sign({ id: 3, username: 'admin-test', role }, 'promotion-test-secret');
  };
  const adminHeaders = () => ({ Authorization: `Bearer ${token('admin')}`, 'Content-Type': 'application/json' });

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/admin/promotions', authMiddleware, adminPromotionRoutes);
    app.use('/public/promotions', publicPromotionRoutes);
    app.use(errorHandlerMiddleware);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  test.each(['', 'chuyen_vien', 'giao_dich_vien', 'nhan_vien'])('requires admin on all reads and writes for %s', async (role) => {
    for (const [method, path] of [['GET', ''], ['GET', '/1'], ['POST', ''], ['PUT', '/1'], ['DELETE', '/1']]) {
      const result = await fetch(`${base}/admin/promotions${path}`, { method, headers: role ? { Authorization: `Bearer ${token(role)}` } : {} });
      expect(result.status).toBe(role ? 403 : 401);
    }
    expect(promotionService.list).not.toHaveBeenCalled();
    expect(promotionService.create).not.toHaveBeenCalled();
    expect(AuditLog.create).not.toHaveBeenCalled();
  });
  test('allows public selection, passes normalized page/device and prevents stale caches', async () => {
    (promotionService.listPublic as jest.Mock).mockResolvedValue([]);
    const result = await fetch(`${base}/public/promotions?path=/goi-cuoc/%3Ffrom=home&device=mobile`);
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(promotionService.listPublic).toHaveBeenCalledWith({ path: '/goi-cuoc', device: 'mobile' });
    expect((await fetch(`${base}/public/promotions?device=all`)).status).toBe(422);
  });
  test('admin writes generate audit log with previous and new values', async () => {
    const original = { id: 9, name: 'Ưu đãi', title: 'Bạn có quà', content: 'Giảm 20%', is_active: true };
    const updated = { ...original, is_active: false };
    (promotionService.update as jest.Mock).mockResolvedValue({ previous: original, promotion: { ...updated, toJSON: () => updated } });
    const response = await fetch(`${base}/admin/promotions/9`, { method: 'PUT', headers: adminHeaders(), body: JSON.stringify({ is_active: false }) });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(promotionService.update).toHaveBeenCalledWith(9, { is_active: false });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 3, action: 'update', module: 'promotions', target_id: 9, old_value: original, new_value: updated }));
  });
  test('validates ids and bodies before calling storage and never audits rejected writes', async () => {
    const headers = adminHeaders();
    expect((await fetch(`${base}/admin/promotions/NaN`, { headers })).status).toBe(422);
    expect((await fetch(`${base}/admin/promotions`, { method: 'POST', headers, body: JSON.stringify({ name: 'X', title: 'X', content: 'X', cta_link: 'javascript:alert(1)' }) })).status).toBe(422);
    expect((await fetch(`${base}/admin/promotions/9`, { method: 'PUT', headers, body: JSON.stringify({ impression_count: 200 }) })).status).toBe(422);
    expect(promotionService.get).not.toHaveBeenCalled();
    expect(promotionService.create).not.toHaveBeenCalled();
    expect(promotionService.update).not.toHaveBeenCalled();
    expect(AuditLog.create).not.toHaveBeenCalled();
  });
  test('parses public tracking with a bounded UUID and returns dedup result', async () => {
    (promotionService.recordEvent as jest.Mock).mockResolvedValue({ recorded: false });
    const dto = { event: 'impression', visit_id: '738E15C8-8BD9-4721-91D7-FDD4C65B10D7' };
    const response = await fetch(`${base}/public/promotions/9/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ data: { recorded: false } }));
    expect(promotionService.recordEvent).toHaveBeenCalledWith(9, { ...dto, visit_id: dto.visit_id.toLowerCase() });
    expect((await fetch(`${base}/public/promotions/9/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'invalid', visit_id: dto.visit_id }) })).status).toBe(422);
  });
});
