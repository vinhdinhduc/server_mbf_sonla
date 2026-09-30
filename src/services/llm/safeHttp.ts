import { lookup } from 'dns';
import { request } from 'https';
import { BlockList, isIP } from 'net';
import { Readable } from 'stream';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 96], ['::ffff:0:0', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48],
  ['100::', 64], ['2001::', 32], ['2001:db8::', 32], ['2002::', 16],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) blocked.addSubnet(address, prefix, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return Boolean(family) && !blocked.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

export function validateBaseUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('URL endpoint không hợp lệ'); }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.port && url.port !== '443') || host === 'localhost' || !host.includes('.') && !isIP(host) ||
      /\.(localhost|local|internal|home|lan)$/.test(host) || (isIP(host) && !isPublicAddress(host))) {
    throw new Error('Endpoint phải dùng HTTPS và địa chỉ Internet công khai');
  }
  return url;
}

/** DNS is checked in the actual socket lookup, so rebinding cannot bypass a preflight check.
 * No redirects, proxy env variables, pooled sockets or caller-supplied Host headers. */
export function customFetch(url: string, init: { method?: string; headers: Record<string, string>; body?: string; signal: AbortSignal }): Promise<Response> {
  const parsed = validateBaseUrl(url);
  return new Promise((resolve, reject) => {
    const req = request(parsed, {
      method: init.method || 'GET', headers: init.headers, signal: init.signal, agent: false,
      lookup: (hostname, _options, callback) => {
        lookup(hostname, { all: true }, (error, addresses) => {
          if (error) { callback(error, '', 4); return; }
          if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address))) {
            callback(new Error('Endpoint không được phép truy cập mạng nội bộ'), '', 4); return;
          }
          // Pin exactly the vetted address used by this TLS connection; hostname/SNI remains intact.
          callback(null, addresses[0].address, addresses[0].family);
        });
      },
    }, (res) => {
      if ((res.statusCode || 0) >= 300 && (res.statusCode || 0) < 400) {
        res.destroy(); reject(new Error('Endpoint không được chuyển hướng')); return;
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(res.headers)) if (value) headers.set(key, String(value));
      resolve(new Response(Readable.toWeb(res) as unknown as ConstructorParameters<typeof Response>[0], { status: res.statusCode, headers }));
    });
    req.on('error', reject);
    req.end(init.body);
  });
}

export async function readJson(response: Response): Promise<any> {
  if (!response.body) throw new Error('Nhà cung cấp trả về dữ liệu trống');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4 * 1024 * 1024) throw new Error('Phản hồi vượt giới hạn cho phép');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => undefined); }
}
