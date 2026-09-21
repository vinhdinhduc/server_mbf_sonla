import { buildImageUrl } from '../../src/utils/buildImageUrl';

describe('buildImageUrl', () => {
  it('giữ đường dẫn upload ở dạng tương đối', () => {
    expect(buildImageUrl('uploads/2026/09/banner.webp')).toBe('/uploads/2026/09/banner.webp');
  });

  it('loại bỏ origin localhost của dữ liệu cũ', () => {
    expect(buildImageUrl('http://localhost:4000/uploads/banner.webp')).toBe('/uploads/banner.webp');
  });

  it('giữ URL CDN bên ngoài', () => {
    expect(buildImageUrl('https://cdn.example.com/banner.webp')).toBe(
      'https://cdn.example.com/banner.webp',
    );
  });
});
