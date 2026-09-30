/* Back up first; never put a DB password in argv or print child-process errors. */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const zlib = require('zlib');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const migration = '20260930000001-ai-provider-usage.js';
const cwd = path.resolve(__dirname, '..');
function option(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`;
}
function finished(child) {
  return new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error('Không khởi chạy được chương trình.')));
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('Lệnh thất bại; migration chưa được xác nhận thành công.')),
    );
  });
}
async function main() {
  const direction = process.argv[2];
  if (!['up', 'down'].includes(direction))
    throw new Error('Dùng: node scripts/ai-migrate.cjs up|down');
  const directory = path.join(cwd, 'backups');
  await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mfsl-ai-backup-'));
  const credentials = path.join(temporary, 'client.cnf');
  const destination = path.join(directory, `ai-before-${direction}-${Date.now()}.sql.gz`);
  try {
    await fs.promises.writeFile(
      credentials,
      '[client]\n' +
        ['host', 'port', 'user', 'password']
          .map((key) => {
            const names = {
              host: 'DB_HOST',
              port: 'DB_PORT',
              user: 'DB_USER',
              password: 'DB_PASSWORD',
            };
            return `${key}=${option(process.env[names[key]] || (key === 'port' ? '3306' : ''))}`;
          })
          .join('\n') +
        '\n',
      { mode: 0o600, flag: 'wx' },
    );
    const child = spawn(
      'mysqldump',
      [
        `--defaults-extra-file=${credentials}`,
        '--single-transaction',
        '--quick',
        '--hex-blob',
        '--no-tablespaces',
        '--databases',
        process.env.DB_NAME,
      ],
      { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    await Promise.all([
      finished(child),
      pipeline(
        child.stdout,
        zlib.createGzip(),
        fs.createWriteStream(destination, { flags: 'wx', mode: 0o600 }),
      ),
    ]);
    // Verify gzip integrity, then store a checksum for restore verification.
    let bytes = 0;
    const verify = fs.createReadStream(destination).pipe(zlib.createGunzip());
    for await (const chunk of verify) bytes += chunk.length;
    if (bytes === 0) throw new Error('Bản sao lưu trống.');
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(destination)) hash.update(chunk);
    await fs.promises.writeFile(`${destination}.sha256`, hash.digest('hex') + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    console.log(`Đã xác minh sao lưu: ${destination}`);
  } finally {
    await fs.promises.unlink(credentials).catch(() => {});
    await fs.promises.rmdir(temporary).catch(() => {});
  }
  const args =
    direction === 'up'
      ? ['db:migrate', '--to', migration]
      : ['db:migrate:undo', '--name', migration];
  await finished(
    spawn(process.execPath, [require.resolve('sequelize-cli/lib/sequelize'), ...args], {
      cwd,
      windowsHide: true,
      stdio: 'inherit',
    }),
  );
}
main().catch((error) => {
  console.error(error.message && !error.sql ? error.message : 'Sao lưu hoặc migration thất bại.');
  process.exitCode = 1;
});
