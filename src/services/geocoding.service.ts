import { AppError } from '../utils/AppError';

export interface GeocodingResult {
  lat: number;
  lng: number;
  label: string;
  source: 'nominatim';
}
export interface GeocodingProvider {
  search(address: string): Promise<GeocodingResult | null>;
}

const cache = new Map<string, { expires: number; value: GeocodingResult | null }>();
let nextRequestAt = 0;

export const nominatimProvider: GeocodingProvider = {
  async search(address) {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Chưa cấu hình nhà cung cấp tìm vị trí cho môi trường production', 503);
    }
    const userAgent = process.env.GEOCODING_USER_AGENT;
    if (!userAgent) throw new AppError('Chưa cấu hình GEOCODING_USER_AGENT', 503);
    const key = address.trim().toLocaleLowerCase('vi-VN');
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;

    const delay = Math.max(0, nextRequestAt - Date.now());
    nextRequestAt = Math.max(Date.now(), nextRequestAt) + 1100;
    if (delay)
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', `${address}, Sơn La, Việt Nam`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    const response = await fetch(url, {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new AppError('Dịch vụ tìm vị trí tạm thời không khả dụng', 503);
    const results = (await response.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    const result = results[0]
      ? {
          lat: Number(results[0].lat),
          lng: Number(results[0].lon),
          label: results[0].display_name,
          source: 'nominatim' as const,
        }
      : null;
    cache.set(key, { expires: Date.now() + 24 * 60 * 60 * 1000, value: result });
    return result;
  },
};
