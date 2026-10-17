// Apply only the gift promotion migration to the configured local development DB.
// Schema and the four legacy popup keys are backed up without unrelated secrets.
const fs = require('node:fs/promises');
const path = require('node:path');
const { Sequelize, QueryTypes } = require('sequelize');
const config = require('../src/config/sequelize-cli.config').development;
const filename = '20261013000001-create-promotions.js';
const migration = require(`../migrations/${filename}`);
if (!['localhost', '127.0.0.1', '::1'].includes(config.host) || process.env.NODE_ENV === 'production') {
  throw new Error('This helper only applies to a local development database.');
}
const db = new Sequelize({ ...config, logging: false });
(async () => {
  const query = db.getQueryInterface();
  const tables = new Set((await query.showAllTables()).map(String));
  const hasMetadata = [...tables].some((table) => table.toLowerCase() === 'sequelizemeta');
  const applied = hasMetadata ? await db.query('SELECT name FROM SequelizeMeta WHERE name=:name', {
    replacements: { name: filename }, type: QueryTypes.SELECT,
  }) : [];
  if (applied.length) { console.log('Promotion migration already applied.'); return; }
  const legacySettings = tables.has('settings') ? await db.query(
    'SELECT `key`, `value` FROM settings WHERE `key` IN (:keys)', {
      replacements: { keys: ['promo_popup_enabled', 'promo_popup_title', 'promo_popup_content', 'promo_popup_url'] },
      type: QueryTypes.SELECT,
    },
  ) : [];
  const snapshot = {
    database: config.database, migration: filename, captured_at: new Date().toISOString(),
    previous_tables: [...tables], legacy_popup_settings: legacySettings,
    promotions_schema: tables.has('promotions') ? await query.describeTable('promotions') : null,
    promotion_events_schema: tables.has('promotion_events') ? await query.describeTable('promotion_events') : null,
  };
  const backup = path.resolve(__dirname, '../backups', `promotions-schema-${Date.now()}.json`);
  await fs.mkdir(path.dirname(backup), { recursive: true });
  await fs.writeFile(backup, JSON.stringify(snapshot, null, 2) + '\n');
  await migration.up(query, Sequelize);
  if (hasMetadata) await db.query('INSERT INTO SequelizeMeta(name) VALUES (:name)', { replacements: { name: filename } });
  console.log(JSON.stringify({ applied: filename, database: config.database, previous_schema: backup, sequelize_metadata_recorded: hasMetadata }));
})().catch((error) => {
  console.error('Promotion migration did not complete; no other migration was executed.', {
    name: error.name, database_code: error.parent?.code || null,
  });
  process.exitCode = 1;
}).finally(() => db.close());
