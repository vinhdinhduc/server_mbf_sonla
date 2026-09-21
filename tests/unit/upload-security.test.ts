import { hasValidImageSignature, readImageDimensions } from '../../src/config/multer';

describe('bảo mật upload ảnh', () => {
  it('từ chối nội dung thực thi giả mạo ảnh', () => {
    expect(hasValidImageSignature(Buffer.from('MZ executable pretending to be image'))).toBe(false);
  });

  it('nhận diện PNG và đọc đúng kích thước', () => {
    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
    png.writeUInt32BE(1200, 16);
    png.writeUInt32BE(800, 20);
    expect(hasValidImageSignature(png)).toBe(true);
    expect(readImageDimensions(png)).toEqual({ width: 1200, height: 800 });
  });

  it('đọc được kích thước GIF', () => {
    const gif = Buffer.alloc(10);
    gif.write('GIF89a', 0, 'ascii');
    gif.writeUInt16LE(320, 6);
    gif.writeUInt16LE(240, 8);
    expect(readImageDimensions(gif)).toEqual({ width: 320, height: 240 });
  });
});
