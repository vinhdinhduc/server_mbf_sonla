// Apply only the three approved additive widget fields to the configured local
// development DB; never run unrelated pending migrations or touch AI settings.
const fs = require('node:fs');
const path = require('node:path');
const { Sequelize } = require('sequelize');
const config = require('../src/config/sequelize-cli.config').development;
const migrationName = '20261006000001-chatbot-widget.js';
const migration = require(`../migrations/${migrationName}`);
if (!['localhost', '127.0.0.1', '::1'].includes(config.host) || process.env.NODE_ENV === 'production') throw new Error('This helper only applies to a local development database.');
const db = new Sequelize({ ...config, logging: false });
(async () => {
  const query = db.getQueryInterface();
  const tables = await query.showAllTables();
  const hasMetadata = tables.some((table) => String(table).toLowerCase() === 'sequelizemeta');
  const [applied] = hasMetadata ? await db.query('SELECT name FROM SequelizeMeta WHERE name=:name', { replacements: { name: migrationName } }) : [[]];
  if (applied.length) { console.log('Widget migration already applied.'); return; }
  const before = {
    database: config.database,
    migration: migrationName,
    captured_at: new Date().toISOString(),
    contacts: await query.describeTable('contact_messages'),
    logs: await query.describeTable('ai_chat_logs'),
  };
  const backup = path.resolve(__dirname, '../backups', `chatbot-widget-schema-${Date.now()}.json`);
  fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n');
  await migration.up(query, Sequelize);
  if (hasMetadata) await db.query('INSERT INTO SequelizeMeta(name) VALUES (:name)', { replacements: { name: migrationName } });
  console.log(JSON.stringify({ applied: migrationName, database: config.database, previous_schema: backup, sequelize_metadata_recorded: hasMetadata }));
})().catch((error) => { console.error('Widget migration did not complete; no other migration was executed.', { name: error.name, database_code: error.parent?.code || null }); process.exitCode = 1; }).finally(() => db.close());
