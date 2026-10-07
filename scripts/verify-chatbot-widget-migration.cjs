// Verify only this additive migration in a fresh, disposable local schema.
// Never migrate, seed, clear or drop the configured application database.
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');
const config = require('../src/config/sequelize-cli.config').development;
const migration = require('../migrations/20261006000001-chatbot-widget');
const name = `chatbot_widget_verify_${Date.now()}`;
if (!['localhost', '127.0.0.1', '::1'].includes(config.host) || !/^chatbot_widget_verify_\d+$/.test(name)) throw new Error('Verification requires a local, uniquely named test database.');
const db = new Sequelize({ ...config, logging: false });
let sandbox;
(async () => {
  await db.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  try {
    sandbox = new Sequelize({ ...config, database: name, logging: false });
    const query = sandbox.getQueryInterface();
    await query.createTable('contact_messages', { id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true }, email: { type: Sequelize.STRING(100), allowNull: false } });
    await query.createTable('ai_chat_logs', { id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true } });
    await query.createTable('settings', { key: { type: Sequelize.STRING(100), primaryKey: true }, value: Sequelize.TEXT, group: Sequelize.STRING(30), updated_at: Sequelize.DATE });
    await sandbox.query("INSERT INTO contact_messages(email) VALUES ('existing@example.com')");
    await migration.up(query, Sequelize);
    assert.equal((await query.describeTable('contact_messages')).source.allowNull, false);
    assert.ok((await query.describeTable('ai_chat_logs')).feedback_comment);
    const [contacts] = await sandbox.query('SELECT source,email FROM contact_messages');
    assert.equal(contacts[0].source, 'website'); assert.equal(contacts[0].email, 'existing@example.com');
    await sandbox.query("INSERT INTO contact_messages(email, source) VALUES ('', 'chatbot')");
    await sandbox.query("INSERT INTO ai_chat_logs(feedback_comment) VALUES ('Cần cập nhật giá')");
    const [settings] = await sandbox.query('SELECT value FROM settings');
    assert.deepEqual(JSON.parse(settings[0].value), ['Gói cước nào rẻ?', 'Cửa hàng gần tôi', 'Tư vấn giải pháp doanh nghiệp']);
    await migration.down(query);
    assert.equal((await query.describeTable('contact_messages')).source, undefined);
    assert.equal((await query.describeTable('ai_chat_logs')).feedback_comment, undefined);
    const [remaining] = await sandbox.query('SELECT COUNT(*) AS total FROM contact_messages');
    assert.equal(Number(remaining[0].total), 2);
    console.log('PASS: migration up/down, existing contacts preserved, chatbot source, feedback and default suggestions verified in isolated MySQL schema.');
  } finally {
    await sandbox?.close();
    // name is a constant prefix plus timestamp, validated above. This database
    // was created by this process and contains verification fixtures only.
    await db.query(`DROP DATABASE \`${name}\``);
  }
})().catch(() => { console.error('Migration verification failed; application database was not changed.'); process.exitCode = 1; }).finally(() => db.close());
