// Apply/undo/reapply this migration and exercise the service in an isolated local MySQL schema.
// Never migrate, seed, clear or drop the configured application database.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Sequelize, QueryTypes } = require('sequelize');
const config = require('../src/config/sequelize-cli.config').development;
const name = `promotions_verify_${Date.now()}`;
const migration = require('../migrations/20261013000001-create-promotions');
if (!['localhost', '127.0.0.1', '::1'].includes(config.host) || process.env.NODE_ENV === 'production'
  || !/^promotions_verify_\d+$/.test(name) || name === config.database) {
  throw new Error('This verification requires a local, uniquely named test database.');
}
const db = new Sequelize({ ...config, logging: false });
let sandbox;
let runtime;
let created = false;
(async () => {
  await db.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  created = true;
  sandbox = new Sequelize({ ...config, database: name, logging: false });
  const query = sandbox.getQueryInterface();
  await query.createTable('settings', {
    key: { type: Sequelize.STRING(100), primaryKey: true },
    value: { type: Sequelize.TEXT, allowNull: false },
  });
  await query.bulkInsert('settings', [
    { key: 'promo_popup_enabled', value: 'true' },
    { key: 'promo_popup_title', value: 'Ưu đãi hiện có' },
    { key: 'promo_popup_content', value: 'Giảm 20%' },
    { key: 'promo_popup_url', value: '/goi-cuoc' },
  ]);
  await migration.up(query, Sequelize);
  const legacy = await sandbox.query('SELECT * FROM promotions', { type: QueryTypes.SELECT });
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].title, 'Ưu đãi hiện có');
  assert.equal(legacy[0].cta_link, '/goi-cuoc');
  assert.equal(legacy[0].trigger_value, 2);
  assert.equal(Boolean(legacy[0].is_active), true);
  // Interrupted DDL can be resumed without duplicate campaign import or indexes.
  await migration.up(query, Sequelize);
  assert.equal(Number((await sandbox.query('SELECT COUNT(*) AS total FROM promotions', { type: QueryTypes.SELECT }))[0].total), 1);
  assert.equal((await query.showIndex('promotion_events')).filter((index) => index.name === 'promotion_event_visit_unique').length, 1);
  await migration.down(query);
  assert.equal((await query.showAllTables()).includes('promotions'), false);
  assert.equal(Number((await sandbox.query('SELECT COUNT(*) AS total FROM settings', { type: QueryTypes.SELECT }))[0].total), 4);
  await migration.up(query, Sequelize);

  // Load the real service only after redirecting its connection into this disposable schema.
  process.env.DB_NAME = name;
  process.env.NODE_ENV = 'test';
  require('ts-node/register');
  const { sequelize } = require('../src/config/database');
  runtime = sequelize;
  const { Promotion, initPromotionModel } = require('../src/models/Promotion.model');
  const { PromotionEvent, initPromotionEventModel } = require('../src/models/PromotionEvent.model');
  const { promotionService } = require('../src/services/promotion.service');
  const { createPromotionSchema, updatePromotionSchema } = require('../src/validators/promotion.validator');
  initPromotionModel(sequelize);
  initPromotionEventModel(sequelize);
  const fixture = await promotionService.create(createPromotionSchema.parse({
    name: `Local verification ${randomUUID()}`, title: 'Quà kiểm thử', content: 'Ưu đãi kiểm thử',
    cta_text: 'Xem ngay', cta_link: '/goi-cuoc', is_active: true, target_pages: ['/kiem-thu-qua'],
    device: 'mobile', trigger_type: 'scroll', trigger_value: 50,
  }));
  const rows = await promotionService.listPublic({ path: '/kiem-thu-qua/', device: 'mobile' });
  const publicRow = rows.find((row) => row.id === fixture.id);
  assert(publicRow);
  assert.equal(publicRow.name, undefined);
  assert.equal(publicRow.impression_count, undefined);
  assert.equal((await promotionService.listPublic({ path: '/kiem-thu-qua', device: 'desktop' })).some((row) => row.id === fixture.id), false);
  assert.equal((await promotionService.listPublic({ path: '/', device: 'mobile' })).some((row) => row.id === fixture.id), false);
  const experience = randomUUID();
  for (const event of ['impression', 'open', 'cta']) {
    const results = await Promise.all(Array.from({ length: 4 }, () => promotionService.recordEvent(fixture.id, { event, visit_id: experience })));
    assert.equal(results.filter((result) => result.recorded).length, 1);
  }
  await promotionService.recordEvent(fixture.id, { event: 'impression', visit_id: randomUUID() });
  await fixture.reload();
  assert.equal(fixture.impression_count, 2);
  assert.equal(fixture.open_count, 1);
  assert.equal(fixture.cta_count, 1);
  assert.equal(await PromotionEvent.count({ where: { promotion_id: fixture.id } }), 4);
  await assert.rejects(promotionService.update(fixture.id, { trigger_value: 101 }));
  await assert.rejects(promotionService.update(fixture.id, { cta_text: null }));
  await promotionService.update(fixture.id, updatePromotionSchema.parse({ start_at: '2099-01-01T00:00:00Z', end_at: '2099-02-01T00:00:00Z' }));
  await assert.rejects(promotionService.update(fixture.id, updatePromotionSchema.parse({ end_at: '2098-01-01T00:00:00Z' })));
  await assert.rejects(promotionService.recordEvent(fixture.id, { event: 'impression', visit_id: randomUUID() }), (error) => error.statusCode === 404);
  await promotionService.update(fixture.id, { start_at: null, end_at: new Date('2020-01-01T00:00:00Z') });
  await assert.rejects(promotionService.recordEvent(fixture.id, { event: 'open', visit_id: randomUUID() }), (error) => error.statusCode === 404);
  await promotionService.update(fixture.id, { end_at: null, is_active: false });
  await assert.rejects(promotionService.recordEvent(fixture.id, { event: 'cta', visit_id: randomUUID() }), (error) => error.statusCode === 404);
  await promotionService.remove(fixture.id);
  assert.equal(await Promotion.findByPk(fixture.id), null);
  assert.equal(await PromotionEvent.count({ where: { promotion_id: fixture.id } }), 0);
  console.log('PASS: isolated MySQL migration up/down/resume, legacy preservation, public eligibility/privacy, concurrent event deduplication/counters, partial validation, inactive/expired rejection and cascading deletion.');
})().catch((error) => {
  console.error('Promotion verification failed; application database was not changed.', {
    name: error.name, message: error.message, database_code: error.parent?.code || null,
    stack: error.stack,
  });
  process.exitCode = 1;
}).finally(async () => {
  await runtime?.close();
  await sandbox?.close();
  // The fixed-prefix, validated database name was created by this process and holds verification fixtures only.
  if (created) await db.query(`DROP DATABASE \`${name}\``);
  await db.close();
});
