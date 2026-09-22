import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { Request, Response } from 'express';
import { hasValidImageSignature, readImageDimensions, validateUploadedImage } from '../../src/config/multer';

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

  it('chuyển ảnh tải lên thành WebP và tạo hai kích cỡ nhỏ', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mfsl-upload-test-'));
    try {
      const originalPath = path.join(tempDir, 'sample.png');
      await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#0088cc' } })
        .png().toFile(originalPath);
      const file = { path: originalPath, filename: 'sample.png', mimetype: 'image/png', size: 0 } as Express.Multer.File;
      const next = jest.fn();
      await validateUploadedImage({ file } as Request, {} as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(file.filename).toBe('sample-optimized.webp');
      expect(file.mimetype).toBe('image/webp');
      expect(fs.existsSync(originalPath)).toBe(false);
      expect((await sharp(await fs.promises.readFile(file.path)).metadata()).format).toBe('webp');
      expect((await sharp(await fs.promises.readFile(path.join(tempDir, 'sample-480.webp'))).metadata()).width).toBe(480);
      expect((await sharp(await fs.promises.readFile(path.join(tempDir, 'sample-960.webp'))).metadata()).width).toBe(960);
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });
});
