/**
 * API chỉ trả đường dẫn upload tương đối; frontend ghép ASSET_BASE_URL.
 * URL bên ngoài hợp lệ vẫn được giữ nguyên.
 */
export function buildImageUrl(relativePathOrNull: string | null | undefined): string | null {
  if (!relativePathOrNull) return null;
  if (/^https?:\/\//i.test(relativePathOrNull)) {
    try {
      const absoluteUrl = new URL(relativePathOrNull);
      if (!['localhost', '127.0.0.1', '::1'].includes(absoluteUrl.hostname)) {
        return relativePathOrNull;
      }
      return `${absoluteUrl.pathname}${absoluteUrl.search}`;
    } catch {
      return relativePathOrNull;
    }
  }

  const cleanPath = relativePathOrNull.replace(/^\/+/, '');
  return `/${cleanPath}`;
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
