import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../src/middlewares/auth.middleware';
import { User } from '../../src/models/User.model';
jest.mock('../../src/config/env', () => ({ env: { JWT_SECRET: 'session-test-secret' } }));
jest.mock('../../src/models/User.model', () => ({ User: { findByPk: jest.fn() } }));
const account = { id: 1, username: 'user', role: 'admin', status: 'active', session_version: 2 };
function authenticate(version?: number) {
  const token = jwt.sign(
    { id: 1, username: 'user', role: 'admin', session_version: version },
    'session-test-secret',
  );
  const req = { headers: { authorization: `Bearer ${token}` } };
  return new Promise<any>((resolve) =>
    authMiddleware(req as any, {} as any, (error?: unknown) => resolve({ error, req })),
  );
}
it('rejects old and legacy tokens after reset, accepts only the current session version', async () => {
  (User.findByPk as jest.Mock).mockResolvedValue(account);
  expect((await authenticate(1)).error.statusCode).toBe(401);
  expect((await authenticate()).error.statusCode).toBe(401);
  expect((await authenticate(2)).error).toBeUndefined();
});
it('rejects a locked user with a valid token', async () => {
  (User.findByPk as jest.Mock).mockResolvedValue({ ...account, status: 'locked' });
  expect((await authenticate(2)).error.statusCode).toBe(401);
});
