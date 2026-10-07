// Exercise the actual multipart controller, service, MySQL locking and admin CV route.
// Only a new local database and CVs owned by this process are removed.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Sequelize } = require('sequelize');
const config = require('../src/config/sequelize-cli.config').development;
const name = `recruitment_verify_${Date.now()}`;
if (!['localhost', '127.0.0.1', '::1'].includes(config.host) || !/^recruitment_verify_\d+$/.test(name)) throw new Error('A local isolated database is required.');
const root = new Sequelize({ ...config, logging: false });
const ownedFiles = new Set();
let appDb; let listener;
(async () => {
  await root.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  try {
    process.env.DB_NAME = name;
    process.env.NODE_ENV = 'test';
    process.env.E2E_DB_ISOLATED = '1';
    process.env.RECAPTCHA_TEST_BYPASS_TOKEN = 'recruitment-isolated-token';
    require('ts-node/register/transpile-only');
    const { sequelize, Job, JobApplication, Store, User, Setting } = require('../src/models');
    const { privateCvDir, receiveCvUpload, validateUploadedCv } = require('../src/config/multer');
    const { jobController } = require('../src/controllers/job.controller');
    const { jobService } = require('../src/services/job.service');
    const { authMiddleware } = require('../src/middlewares/auth.middleware');
    const { checkRole } = require('../src/middlewares/checkRole.middleware');
    const { errorHandlerMiddleware } = require('../src/middlewares/errorHandler.middleware');
    const { asyncHandler } = require('../src/utils/asyncHandler');
    const { env } = require('../src/config/env');
    appDb = sequelize;
    assert.equal(sequelize.config.database, name);
    await Store.sync(); await User.sync(); await Job.sync(); await JobApplication.sync(); await Setting.sync();
    const qi = sequelize.getQueryInterface();
    await require('../migrations/20260922000008-rate-limits').up(qi, Sequelize);
    const rateMigration = require('../migrations/20261006000002-recruitment-rate-limit');
    await rateMigration.up(qi); await rateMigration.up(qi);
    const [quota] = await sequelize.query("SELECT * FROM rate_limit_policies WHERE `key`='job_application'");
    assert.equal(quota.length, 1); assert.equal(quota[0].max_requests, 5);
    // The verification app never starts the email worker or connects to SMTP.
    await qi.createTable('email_templates', { key: { type: Sequelize.STRING(100), primaryKey: true }, name: Sequelize.STRING(150), subject: Sequelize.STRING(255), html: Sequelize.TEXT('long'), enabled: Sequelize.BOOLEAN, updated_at: Sequelize.DATE });
    await qi.createTable('email_outbox', { id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true }, idempotency_key: { type: Sequelize.STRING(150), unique: true }, recipient: Sequelize.STRING(255), template_key: Sequelize.STRING(100), data_json: Sequelize.JSON, status: Sequelize.STRING(30), attempts: Sequelize.INTEGER, next_attempt_at: Sequelize.DATE, created_at: Sequelize.DATE });
    await Setting.bulkCreate([{ key: 'notify_email', value: 'staff@example.invalid', group: 'general' }, { key: 'hotline', value: '18001090', group: 'general' }, { key: 'site_name', value: 'MobiFone Sơn La', group: 'general' }]);
    const fixture = { title: 'Vị trí kiểm thử', category: 'Kinh doanh', employment_type: 'full_time', location: 'Sơn La', quantity: 1, salary_type: 'hidden', description: '<p>Nội dung</p>', deadline: '2027-12-31', status: 'recruiting' };
    const job = await Job.create({ ...fixture, slug: 'vi-tri-kiem-thu' });
    const other = await Job.create({ ...fixture, slug: 'vi-tri-khac' });
    const paused = await Job.create({ ...fixture, slug: 'vi-tri-tam-dung', status: 'paused' });
    await Job.create({ ...fixture, slug: 'ban-nhap', status: 'draft' });
    assert.equal((await jobService.publicDetail('vi-tri-tam-dung')).status, 'paused');
    await assert.rejects(jobService.publicDetail('ban-nhap'), /Không tìm thấy/);
    const admin = await User.create({ username: 'recruitment-test-admin', password_hash: 'unused-test-password', full_name: 'Kiểm thử', email: 'admin@example.invalid', phone: '0999999999', role: 'admin', status: 'active' });
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: admin.id, username: admin.username, role: admin.role, session_version: admin.session_version }, env.JWT_SECRET, { expiresIn: '5m' });
    const app = require('express')();
    app.post('/public/job-applications', receiveCvUpload, (req, _res, next) => { if (req.file) ownedFiles.add(req.file.path); next(); }, validateUploadedCv, asyncHandler(jobController.apply));
    app.get('/admin/jobs/applications', authMiddleware, checkRole(['admin', 'chuyen_vien']), asyncHandler(jobController.applications));
    app.get('/admin/jobs/applications/:id/cv', authMiddleware, checkRole(['admin', 'chuyen_vien']), asyncHandler(jobController.cv));
    app.use(errorHandlerMiddleware);
    listener = await new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
    const base = `http://127.0.0.1:${listener.address().port}`;
    const pdf = Buffer.from('%PDF-1.7\nCV isolated verification\n%%EOF');
    async function submit(overrides = {}, cv = { name: 'cv.pdf', mime: 'application/pdf', contents: pdf }) {
      const form = new FormData();
      const values = { job_id: String(job.id), full_name: 'Ứng viên kiểm thử', phone: '+84 912 345 678', email: 'candidate@example.invalid', agreed_terms: 'true', recaptcha_token: 'recruitment-isolated-token', ...overrides };
      for (const [key, value] of Object.entries(values)) if (value !== null) form.set(key, value);
      if (cv) form.set('cv', new Blob([cv.contents], { type: cv.mime }), cv.name);
      const response = await fetch(`${base}/public/job-applications`, { method: 'POST', body: form });
      return { status: response.status, body: await response.json() };
    }
    const concurrent = await Promise.all([submit(), submit()]);
    assert.deepEqual(concurrent.map((result) => result.status).sort(), [201, 409]);
    const accepted = concurrent.find((result) => result.status === 201).body.data;
    assert.equal(await JobApplication.count(), 1);
    const record = await JobApplication.findByPk(accepted.id);
    assert.equal(record.phone, '0912345678'); assert.ok(record.agreed_terms_at); assert.equal(record.job_id, job.id);
    assert.equal((await submit({ email: 'another@example.invalid' })).status, 409);
    assert.equal((await submit({ phone: '0987654321' })).status, 409);
    assert.equal((await submit({ job_id: String(other.id) })).status, 201);
    assert.equal((await submit({ job_id: String(paused.id) })).status, 409);
    assert.equal((await submit({ phone: '0933333333', email: 'no-consent@example.invalid', agreed_terms: 'false' })).status, 422);
    assert.equal((await submit({ phone: '0212345678' })).status, 422);
    assert.equal((await submit({}, null)).status, 400);
    assert.equal((await submit({}, { name: 'cv.pdf', mime: 'text/html', contents: pdf })).status, 400);
    assert.equal((await submit({}, { name: 'cv.pdf', mime: 'application/pdf', contents: Buffer.from('MZ executable') })).status, 400);
    assert.equal((await submit({}, { name: 'cv.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', contents: Buffer.from('PK\x03\x04fake zip') })).status, 400);
    assert.equal((await submit({}, { name: 'cv.pdf', mime: 'application/pdf', contents: Buffer.alloc(5 * 1024 * 1024 + 1) })).status, 400);
    const Zip = require('jszip');
    const word = new Zip();
    word.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    word.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>CV kiểm thử</w:t></w:r></w:p></w:body></w:document>');
    assert.equal((await submit({ phone: '0955555555', email: 'docx@example.invalid' }, { name: 'cv.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', contents: await word.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) })).status, 201);
    const pool = await Promise.all([submit({ job_id: null, phone: '0977777777', email: 'pool@example.invalid' }), submit({ job_id: null, phone: '0977777777', email: 'pool@example.invalid' })]);
    assert.deepEqual(pool.map((result) => result.status).sort(), [201, 409]);
    await sequelize.query('UPDATE job_applications SET created_at=:time WHERE id=:id', { replacements: { time: new Date(Date.now() - 25 * 3600_000), id:record.id }, logging:false });
    assert.equal((await submit()).status, 201);
    const anon = await fetch(`${base}/admin/jobs/applications/${accepted.id}/cv`);
    assert.equal(anon.status, 401);
    const list = await fetch(`${base}/admin/jobs/applications`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json());
    assert.equal(list.data[0].job.title, fixture.title);
    assert.equal(list.data.some((item) => 'cv_path' in item), false);
    const download = await fetch(`${base}/admin/jobs/applications/${accepted.id}/cv`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(download.status, 200); assert.equal(download.headers.get('cache-control'), 'private, no-store');
    assert.ok(Buffer.from(await download.arrayBuffer()).equals(pdf));
    const originalPath = record.cv_path;
    await record.update({ cv_path: path.resolve('.env') }, { logging: false });
    assert.equal((await fetch(`${base}/admin/jobs/applications/${accepted.id}/cv`, { headers: { Authorization: `Bearer ${token}` } })).status, 404);
    await record.update({ cv_path: originalPath }, { logging: false });
    assert.equal((await fetch(`${base}/private/cv/${path.basename(originalPath)}`)).status, 404);
    const [applications] = await sequelize.query('SELECT cv_path FROM job_applications');
    const kept = new Set(applications.map((item) => item.cv_path));
    for (const file of ownedFiles) if (!kept.has(file)) await assert.rejects(fs.access(file));
    await rateMigration.down(qi);
    assert.equal(await JobApplication.count(), 5);
    console.log('PASS: real MySQL multipart persistence, job linkage, parallel duplicate protection (position and talent pool), 24h window, consent/CAPTCHA, CV MIME/content/size, failed-upload cleanup, private admin download, path confinement and rate migration up/down.');
  } finally {
    if (listener) { listener.closeAllConnections(); await new Promise((resolve) => listener.close(resolve)); }
    await appDb?.close();
    const cvRoot = path.resolve('private/cv');
    for (const file of ownedFiles) {
      const absolute = path.resolve(file); const relative = path.relative(cvRoot, absolute);
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) await fs.unlink(absolute).catch(() => undefined);
    }
    await root.query(`DROP DATABASE \`${name}\``);
  }
})().catch((error) => { console.error(`Recruitment verification failed: ${error.name}: ${error.message?.split('\n')[0]} at ${error.stack?.split('\n').find(line=>line.includes('verify-recruitment-flow.cjs'))?.trim()}. Expected=${error.expected}, actual=${error.actual}. Application database was not changed.`); process.exitCode = 1; }).finally(() => root.close());
