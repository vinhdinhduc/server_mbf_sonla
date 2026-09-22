import { BlockList, isIP } from 'net';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { AppError } from '../utils/AppError';

export interface RatePolicy { key: string; enabled: number | boolean; max_requests: number; window_seconds: number; block_seconds: number; key_by: string; message: string }
interface IpRule { id: number; kind: 'allow' | 'block'; cidr: string; reason: string | null; expires_at: Date | null }
const defaults: RatePolicy[] = [
  ['login', 5, 900, 900, 'ip_username'], ['contact', 5, 3600, 3600, 'ip'],
  ['registration_ip', 10, 3600, 3600, 'ip'], ['registration_phone', 3, 3600, 3600, 'phone'],
  ['appointment', 5, 3600, 3600, 'ip'], ['newsletter', 5, 3600, 3600, 'ip'],
  ['lookup', 10, 60, 60, 'ip'], ['sim_search', 120, 60, 60, 'ip'],
  ['public_general', 300, 60, 60, 'ip'], ['chat', 30, 60, 60, 'ip'], ['upload', 30, 60, 60, 'user'],
].map(([key, max_requests, window_seconds, block_seconds, key_by]) => ({ key: String(key), max_requests: Number(max_requests), window_seconds: Number(window_seconds), block_seconds: Number(block_seconds), key_by: String(key_by), enabled: true, message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau.' }));
const hits = new Map<string, { times: number[]; blockedUntil: number; ip: string }>();
let cached: { expires: number; policies: RatePolicy[]; rules: IpRule[] } | null = null;

export function invalidateRateConfig() { cached = null; }
export function validateCidr(value: string) {
  const [ip, mask] = value.split('/');
  const family = isIP(ip);
  const prefix = mask === undefined ? (family === 4 ? 32 : 128) : Number(mask);
  if (!family || !Number.isInteger(prefix) || prefix < 0 || prefix > (family === 4 ? 32 : 128)) throw AppError.badRequest('IP/CIDR không hợp lệ');
  return { ip, prefix, family: family === 4 ? 'ipv4' as const : 'ipv6' as const };
}
function matches(cidr: string, address: string) {
  const { ip, prefix, family } = validateCidr(cidr);
  const normalized = address.startsWith('::ffff:') ? address.slice(7) : address;
  if (!isIP(normalized)) return false;
  const list = new BlockList();
  list.addSubnet(ip, prefix, family);
  return list.check(normalized, family);
}
async function config() {
  if (cached && cached.expires > Date.now()) return cached;
  const [policies, rules] = await Promise.all([
    sequelize.query<RatePolicy>('SELECT * FROM rate_limit_policies', { type: QueryTypes.SELECT }),
    sequelize.query<IpRule>('SELECT * FROM rate_limit_ip_rules WHERE expires_at IS NULL OR expires_at>NOW()', { type: QueryTypes.SELECT }),
  ]);
  cached = { expires: Date.now() + 30_000, policies, rules };
  return cached;
}
function routeKeys(method: string, path: string): string[] {
  if (/\/admin\/rate-limits(?:\/|$)/.test(path)) return [];
  if (method === 'POST' && /\/auth\/login$/.test(path)) return ['login'];
  if (method === 'POST' && /\/public\/contacts$/.test(path)) return ['contact'];
  if (method === 'POST' && /\/public\/registrations$/.test(path)) return ['registration_ip', 'registration_phone'];
  if (method === 'POST' && /\/public\/appointments$/.test(path)) return ['appointment'];
  if (method === 'POST' && /\/public\/newsletter\/subscribe$/.test(path)) return ['newsletter'];
  if (method === 'POST' && /\/public\/(chat|chatbot\/message)$/.test(path)) return ['chat'];
  if (method === 'POST' && /\/public\/registrations\/(lookup|receipt)$/.test(path)) return ['lookup'];
  if (method === 'GET' && /\/public\/sims$/.test(path)) return ['sim_search'];
  if (method === 'POST' && /\/admin\/media$/.test(path)) return ['upload'];
  if (path.includes('/public/')) return ['public_general'];
  return [];
}
function identity(policy: RatePolicy, ip: string, body: Record<string, unknown>, userId?: number) {
  if (policy.key_by === 'phone') return String(body.phone || ip).slice(0, 30);
  if (policy.key_by === 'ip_username') return `${ip}:${String(body.username || '').toLowerCase().slice(0, 100)}`;
  if (policy.key_by === 'user') return String(userId || ip);
  return ip;
}
export async function consumeRateLimit(method: string, path: string, ip: string, body: Record<string, unknown> = {}, userId?: number) {
  const keys = routeKeys(method, path);
  if (!keys.length) return null;
  const { policies, rules } = await config();
  if (rules.some((rule) => rule.kind === 'allow' && matches(rule.cidr, ip))) return null;
  const blockedRule = rules.find((rule) => rule.kind === 'block' && matches(rule.cidr, ip));
  if (blockedRule) {
    const until = blockedRule.expires_at ? new Date(blockedRule.expires_at).getTime() : Date.now() + 3600_000;
    return { blocked: true, limit: 0, remaining: 0, reset: Math.ceil(until / 1000), retryAfter: Math.max(1, Math.ceil((until - Date.now()) / 1000)), message: 'Địa chỉ IP đang bị chặn' };
  }
  const now = Date.now();
  const checks = keys.map((key) => {
    const policy = policies.find((item) => item.key === key) || defaults.find((item) => item.key === key)!;
    const bucketKey = `${key}:${identity(policy, ip, body, userId)}`;
    const current = hits.get(bucketKey) || { times: [], blockedUntil: 0, ip };
    const times = current.times.filter((time) => time > now - policy.window_seconds * 1000);
    return { policy, bucketKey, current, times };
  }).filter((item) => item.policy.enabled);
  let limit = Infinity; let remaining = Infinity; let reset = now + 60_000;
  for (const check of checks) {
    const { policy, current, times } = check;
    limit = Math.min(limit, policy.max_requests);
    remaining = Math.min(remaining, Math.max(0, policy.max_requests - times.length - 1));
    reset = Math.min(reset, times.length ? times[0] + policy.window_seconds * 1000 : now + policy.window_seconds * 1000);
    if (current.blockedUntil > now || times.length >= policy.max_requests) {
      const until = current.blockedUntil > now ? current.blockedUntil : now + policy.block_seconds * 1000;
      current.blockedUntil = until;
      hits.set(check.bucketKey, current);
      await sequelize.query('INSERT INTO rate_limit_blocks(policy_key,ip,blocked_at) VALUES (:policy,:ip,NOW())', { replacements: { policy: policy.key, ip } }).catch(() => undefined);
      return { blocked: true, limit: policy.max_requests, remaining: 0, reset: Math.ceil(until / 1000), retryAfter: Math.ceil((until - now) / 1000), message: policy.message };
    }
  }
  for (const check of checks) hits.set(check.bucketKey, { times: [...check.times, now], blockedUntil: 0, ip });
  if (hits.size > 100_000) for (const [key, value] of hits) if (value.blockedUntil < now && value.times.every((time) => time < now - 86400_000)) hits.delete(key);
  return checks.length ? { blocked: false, limit, remaining, reset: Math.ceil(reset / 1000), retryAfter: 0, message: '' } : null;
}

export const rateLimitAdmin = {
  async list() { const current = await config(); return { policies: current.policies, rules: current.rules, active_blocks: [...hits.entries()].filter(([, value]) => value.blockedUntil > Date.now()).map(([key, value]) => ({ key, ip: value.ip, until: new Date(value.blockedUntil).toISOString() })) }; },
  async savePolicy(key: string, input: Partial<RatePolicy>) {
    const current = await config();
    if (!current.policies.some((item) => item.key === key)) throw AppError.notFound('Chính sách không tồn tại');
    const fields = ['enabled', 'max_requests', 'window_seconds', 'block_seconds', 'key_by', 'message'] as const;
    const value = { ...current.policies.find((item) => item.key === key), ...input } as RatePolicy;
    if (!Number.isInteger(value.max_requests) || value.max_requests < 1 || value.max_requests > 100000 || !Number.isInteger(value.window_seconds) || value.window_seconds < 1 || value.window_seconds > 86400 || !Number.isInteger(value.block_seconds) || value.block_seconds < 1 || value.block_seconds > 86400) throw AppError.badRequest('Giới hạn phải từ 1 đến 100.000 và thời gian hợp lệ');
    if (!['ip', 'phone', 'ip_username', 'user'].includes(value.key_by) || value.message.length > 255) throw AppError.badRequest('Cấu hình không hợp lệ');
    await sequelize.query(`UPDATE rate_limit_policies SET ${fields.map((field) => `${field}=:${field}`).join(',')},updated_at=NOW() WHERE \`key\`=:key`, { replacements: { ...Object.fromEntries(fields.map((field) => [field, value[field]])), key } });
    invalidateRateConfig();
  },
  async addRule(kind: 'allow' | 'block', cidr: string, reason?: string, expiresAt?: Date | null) {
    validateCidr(cidr);
    await sequelize.query('INSERT INTO rate_limit_ip_rules(kind,cidr,reason,expires_at,created_at) VALUES (:kind,:cidr,:reason,:expires,NOW())', { replacements: { kind, cidr, reason: reason || null, expires: expiresAt || null } });
    invalidateRateConfig();
  },
  async removeRule(id: number) { await sequelize.query('DELETE FROM rate_limit_ip_rules WHERE id=:id', { replacements: { id } }); invalidateRateConfig(); },
  async unblock(key: string) { hits.delete(key); },
  async reset() { for (const policy of defaults) await this.savePolicy(policy.key, policy); hits.clear(); invalidateRateConfig(); },
  async stats() { return sequelize.query('SELECT policy_key,COUNT(*) AS blocked FROM rate_limit_blocks WHERE blocked_at>DATE_SUB(NOW(),INTERVAL 24 HOUR) GROUP BY policy_key', { type: QueryTypes.SELECT }); },
};
