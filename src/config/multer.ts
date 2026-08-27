import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from './env';

const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

export const uploadImage = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|webp|gif)$/i;
    if (!allowed.test(file.originalname)) {
      cb(new Error('Chi chap nhan file anh (jpg, jpeg, png, webp, gif)'));
      return;
    }
    cb(null, true);
  },
});

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/\.xlsx$/i.test(file.originalname)) {
      cb(new Error('Chi chap nhan file .xlsx'));
      return;
    }
    cb(null, true);
  },
});
