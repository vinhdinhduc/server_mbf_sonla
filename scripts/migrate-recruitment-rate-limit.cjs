// Apply only the additive recruitment quota migration to the configured local DB.
const fs = require('node:fs/promises');
const path = require('node:path');
const { Sequelize } = require('sequelize');
const config = require('../src/config/sequelize-cli.config').development;
const migration = require('../migrations/20261006000002-recruitment-rate-limit');
const filename = '20261006000002-recruitment-rate-limit.js';
if (!['localhost', '127.0.0.1', '::1'].includes(config.host)) throw new Error('This helper requires the configured local DB.');
const db = new Sequelize({ ...config, logging: false });
(async () => {
 const [existing] = await db.query("SELECT * FROM rate_limit_policies WHERE `key`='job_application'");
 const [tracked] = await db.query('SELECT name FROM SequelizeMeta WHERE name=:name', { replacements:{name:filename} });
 const backup = path.resolve('backups', `recruitment-rate-limit-${Date.now()}.json`);
 await fs.mkdir(path.dirname(backup), { recursive:true });
 await fs.writeFile(backup, JSON.stringify({ host:config.host, database:config.database, migration:filename, existing, tracked },null,2));
 await migration.up(db.getQueryInterface());
 await db.query('INSERT IGNORE INTO SequelizeMeta(name) VALUES (:name)', { replacements:{name:filename} });
 console.log(`PASS: recruitment IP quota migration applied; existing configuration preserved. Backup: ${path.relative(process.cwd(),backup)}`);
})().catch(()=>{console.error('Recruitment quota migration failed.');process.exitCode=1;}).finally(()=>db.close());
