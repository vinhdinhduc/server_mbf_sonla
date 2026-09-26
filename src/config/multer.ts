/* eslint-disable no-bitwise, no-continue, no-restricted-syntax, no-await-in-loop, no-void, @typescript-eslint/no-explicit-any -- Kiểm tra tệp tuần tự và phân tích bit magic bytes. */
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { NextFunction, Request, Response } from 'express';
import { env } from './env';
import { AppError } from '../utils/AppError';

const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
const privateCvDir = path.resolve(process.cwd(), 'private', 'cv');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(privateCvDir)) fs.mkdirSync(privateCvDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function hasValidImageSignature(buffer: Buffer): boolean {
  const isJpeg =
    buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  const gifHeader = buffer.subarray(0, 6).toString('ascii');
  return isJpeg || isPng || isWebp || gifHeader === 'GIF87a' || gifHeader === 'GIF89a';
}

export function readImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length >= 24 && buffer.subarray(1, 4).toString('ascii') === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  const gifHeader = buffer.subarray(0, 6).toString('ascii');
  if (buffer.length >= 10 && (gifHeader === 'GIF87a' || gifHeader === 'GIF89a')) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (buffer.length >= 30 && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    const format = buffer.subarray(12, 16).toString('ascii');
    if (format === 'VP8X') {
      return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
    }
    if (format === 'VP8 ' && buffer.subarray(23, 26).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (format === 'VP8L' && buffer[20] === 0x2f && buffer.length >= 25) {
      const b1 = buffer[21];
      const b2 = buffer[22];
      const b3 = buffer[23];
      const b4 = buffer[24];
      return {
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
      };
    }
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker,
        )
      ) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
      } else {
        const segmentLength = buffer.readUInt16BE(offset + 2);
        if (segmentLength < 2) return null;
        offset += segmentLength + 2;
      }
    }
  }
  return null;
}

export const uploadImage = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExtension = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.originalname);
    if (!allowedExtension || !IMAGE_MIME_TYPES.has(file.mimetype)) {
      cb(AppError.badRequest('Chỉ chấp nhận ảnh JPG, PNG, WebP hoặc GIF'));
      return;
    }
    cb(null, true);
  },
});

/** Kiểm tra magic bytes sau khi Multer ghi file; file giả mạo bị xóa ngay. */
export async function validateUploadedImage(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.file?.path) {
    next();
    return;
  }
  const originalPath = req.file.path;
  const basePath = originalPath.slice(0, -path.extname(originalPath).length);
  const mainPath = `${basePath}-optimized.webp`;
  const variantPaths = [480, 960].map((width) => `${basePath}-${width}.webp`);
  try {
    const contents = await fs.promises.readFile(originalPath);
    if (!hasValidImageSignature(contents)) {
      throw AppError.badRequest('Nội dung file không phải là ảnh hợp lệ');
    }
    const dimensions = readImageDimensions(contents);
    if (!dimensions || dimensions.width > 4096 || dimensions.height > 4096) {
      throw AppError.badRequest('Không đọc được kích thước ảnh hoặc ảnh vượt quá 4096 × 4096 px');
    }
    const decoded = await sharp(contents, {
      animated: true,
      limitInputPixels: 4096 * 4096,
    }).metadata();
    if (!decoded.width || !decoded.height || decoded.width > 4096 || decoded.height > 4096) {
      throw AppError.badRequest('Kích thước ảnh không hợp lệ');
    }
    const image = () => sharp(contents, { animated: true, limitInputPixels: 4096 * 4096 }).rotate();
    const main = await image()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(mainPath);
    await Promise.all(
      [480, 960].map((width, index) =>
        decoded.width > width
          ? image()
              .resize({ width, withoutEnlargement: true })
              .webp({ quality: 80 })
              .toFile(variantPaths[index])
          : Promise.resolve(),
      ),
    );
    await fs.promises.unlink(originalPath);
    req.file.path = mainPath;
    req.file.filename = path.basename(mainPath);
    req.file.mimetype = 'image/webp';
    req.file.size = main.size;
    next();
  } catch (error) {
    await Promise.all(
      [originalPath, mainPath, ...variantPaths].map((filePath) =>
        fs.promises.unlink(filePath).catch(() => undefined),
      ),
    );
    next(error instanceof AppError ? error : AppError.badRequest('Không thể xử lý ảnh đã tải lên'));
  }
}

/** Validate and optimize both desktop and mobile banner uploads. */
export async function validateUploadedImages(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const files = Object.values((req.files || {}) as Record<string, Express.Multer.File[]>).flat();
  const processed: string[] = [];
  try {
    for (const file of files) {
      req.file = file;
      await new Promise<void>((resolve, reject) => {
        void validateUploadedImage(req, res, (error?: any) => (error ? reject(error) : resolve()));
      });
      processed.push(file.path);
    }
    req.file = files.find((file) => file.fieldname === 'image');
    next();
  } catch (error) {
    await Promise.all(
      processed.map((filePath) => fs.promises.unlink(filePath).catch(() => undefined)),
    );
    next(error);
  }
}

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/\.xlsx$/i.test(file.originalname)) {
      cb(AppError.badRequest('Chỉ chấp nhận file Excel .xlsx'));
      return;
    }
    cb(null, true);
  },
});

const cvStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, privateCvDir),
  filename: (_req, file, cb) =>
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});
export const uploadCv = multer({
  storage: cvStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /\.(pdf|docx)$/i.test(file.originalname)),
});
export function hasValidCvSignature(buffer: Buffer, originalName: string) {
  const isPdf = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const isDocx =
    buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  return (/\.pdf$/i.test(originalName) && isPdf) || (/\.docx$/i.test(originalName) && isDocx);
}
export async function validateUploadedCv(req: Request, _res: Response, next: NextFunction) {
  if (!req.file) {
    next(AppError.badRequest('Vui lòng tải CV'));
    return;
  }
  try {
    const head = Buffer.alloc(8);
    const handle = await fs.promises.open(req.file.path, 'r');
    await handle.read(head, 0, 8, 0);
    await handle.close();
    if (!hasValidCvSignature(head, req.file.originalname))
      throw AppError.badRequest('Nội dung CV không đúng định dạng PDF/DOCX');
    req.file.mimetype =
      head.subarray(0, 5).toString('ascii') === '%PDF-'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    next();
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    next(error);
  }
}
