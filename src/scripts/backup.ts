import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { env } from '../config/env';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const RETENTION_DAYS = 56; // 8 tuan

function execAsync(command: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function todayFileNameSuffix(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function dumpDatabase(): Promise<string> {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const dateSuffix = todayFileNameSuffix();
  const sqlPath = path.join(BACKUP_DIR, `backup_${dateSuffix}.sql`);
  const gzPath = `${sqlPath}.gz`;

  const passwordFlag = env.DB_PASSWORD ? `-p${env.DB_PASSWORD}` : '';
  const command = `mysqldump -h ${env.DB_HOST} -P ${env.DB_PORT} -u ${env.DB_USER} ${passwordFlag} ${env.DB_NAME} > "${sqlPath}"`;

  // eslint-disable-next-line no-console
  console.log(`⏳ Dang backup database "${env.DB_NAME}"...`);
  await execAsync(command);

  await new Promise<void>((resolve, reject) => {
    const readStream = fs.createReadStream(sqlPath);
    const writeStream = fs.createWriteStream(gzPath);
    const gzip = zlib.createGzip();

    readStream
      .pipe(gzip)
      .pipe(writeStream)
      .on('finish', () => resolve())
      .on('error', reject);
  });

  fs.unlinkSync(sqlPath); // xoa file .sql tho, chi giu file .sql.gz da nen

  // eslint-disable-next-line no-console
  console.log(`✅ Da tao backup: ${gzPath}`);
  return gzPath;
}

function cleanupOldBackups(): void {
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.sql.gz'));
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  files.forEach((file) => {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    if (stats.mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      // eslint-disable-next-line no-console
      console.log(`🗑️  Da xoa backup cu: ${file}`);
    }
  });
}

export async function runBackup(): Promise<void> {
  await dumpDatabase();
  cleanupOldBackups();
}

// Chay truc tiep qua `npm run backup`
if (require.main === module) {
  runBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('❌ Backup that bai:', err);
      process.exit(1);
    });
}
