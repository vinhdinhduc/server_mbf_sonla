import { env } from '../config/env';

/**
 * Ghep duong dan anh tuong doi (vd: '/uploads/abc.jpg' hoac 'uploads/abc.jpg')
 * thanh URL tuyet doi day du dua tren APP_BASE_URL.
 * Neu gia tri da la URL tuyet doi (http/https) thi giu nguyen.
 * Dung 1 noi duy nhat (helper nay) o tang Controller truoc khi tra response,
 * khong lap logic nay o nhieu noi (yeu cau muc 14).
 */
export function buildImageUrl(relativePathOrNull: string | null | undefined): string | null {
  if (!relativePathOrNull) return null;
  const base = env.APP_BASE_URL.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(relativePathOrNull)) {
    try {
      const absoluteUrl = new URL(relativePathOrNull);
      if (!['localhost', '127.0.0.1', '::1'].includes(absoluteUrl.hostname)) {
        return relativePathOrNull;
      }
      return `${base}${absoluteUrl.pathname}${absoluteUrl.search}`;
    } catch {
      return relativePathOrNull;
    }
  }

  const cleanPath = relativePathOrNull.replace(/^\/+/, '');
  return `${base}/${cleanPath}`;
}

/**
 * Duyet 1 danh sach key trong 1 object (hoac mang object) va thay the
 * gia tri bang URL tuyet doi. Dung khi tra ve list co nhieu ban ghi.
 */
export function attachImageUrls<T extends Record<string, any>>(record: T, keys: Array<keyof T>): T {
  const clone: Record<string, any> = { ...record };
  keys.forEach((key) => {
    if (key in clone) {
      clone[key as string] = buildImageUrl(clone[key as string]);
    }
  });
  return clone as T;
}
