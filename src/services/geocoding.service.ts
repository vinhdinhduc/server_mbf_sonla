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
    if (process.env.NODE_ENV === 'production' && !process.env.GEOCODING_SEARCH_URL) {
      throw new AppError('Chưa cấu hình nhà cung cấp tìm vị trí cho môi trường production', 503);
    }
    const userAgent = process.env.GEOCODING_USER_AGENT;
    if (!userAgent) throw new AppError('Chưa cấu hình GEOCODING_USER_AGENT', 503);
    const endpoint =
      process.env.GEOCODING_SEARCH_URL || 'https://nominatim.openstreetmap.org/search';
    const key = `${endpoint}:${address.trim().toLocaleLowerCase('vi-VN')}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;

    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay > 5000)
      throw AppError.tooManyRequests('Dịch vụ tìm địa chỉ đang bận, vui lòng thử lại sau');
    nextRequestAt = Math.max(Date.now(), nextRequestAt) + 1100;
    if (delay)
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    const url = new URL(endpoint);
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
    if (
      result &&
      (!Number.isFinite(result.lat) ||
        !Number.isFinite(result.lng) ||
        Math.abs(result.lat) > 90 ||
        Math.abs(result.lng) > 180)
    ) {
      throw new AppError('Dịch vụ tìm vị trí trả về tọa độ không hợp lệ', 502);
    }
    if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + 24 * 60 * 60 * 1000, value: result });
    return result;
  },
};
