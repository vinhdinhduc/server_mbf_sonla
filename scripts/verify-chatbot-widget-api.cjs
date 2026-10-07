// Check the deployed widget contract using only synthetic chat audit records.
// Does not create contacts or deliver real email notifications.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const config = require('../src/config/sequelize-cli.config').development;
const client = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../../client/.env')));
const base = client.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
const db = new Sequelize({ ...config, logging: false });
async function post(body) {
  const response = await fetch(`${base}/public/chat/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  return { status: response.status, body: await response.json() };
}
(async () => {
  const query = db.getQueryInterface();
  assert.ok((await query.describeTable('contact_messages')).source);
  assert.ok((await query.describeTable('ai_chat_logs')).feedback_comment);
  const response = await fetch(`${base}/public/settings`, { signal: AbortSignal.timeout(5000) });
  const settings = await response.json();
  assert.equal(JSON.parse(settings.data.ai_chatbot_quick_replies).length, 3);
  const [logs] = await db.query('SELECT id,session_id,was_helpful,feedback_comment FROM ai_chat_logs WHERE user_message=:question ORDER BY id DESC LIMIT 1', { replacements: { question: 'Gói KHONGTONTAI999 có giá bao nhiêu và đăng ký thế nào?' } });
  assert.ok(logs.length, 'Synthetic content-audit log must exist');
  const log = logs[0];
  const negative = await post({ session_id: log.session_id, answer_id: Number(log.id), was_helpful: false, comment: 'Kiểm thử widget: xác nhận lưu phản hồi.' });
  assert.equal(negative.status, 200); assert.equal(negative.body.data.saved, true);
  const [saved] = await db.query('SELECT was_helpful,feedback_comment,flagged_for_review FROM ai_chat_logs WHERE id=:id', { replacements: { id: log.id } });
  assert.equal(Number(saved[0].was_helpful), 0); assert.equal(saved[0].feedback_comment, 'Kiểm thử widget: xác nhận lưu phản hồi.'); assert.equal(Number(saved[0].flagged_for_review), 1);
  const invalid = await post({ session_id: 'invalid-audit-session', answer_id: Number(log.id), was_helpful: true });
  assert.equal(invalid.status, 404);
  // Restore feedback fields on this synthetic record after validation.
  await db.query('UPDATE ai_chat_logs SET was_helpful=:helpful,feedback_comment=:comment WHERE id=:id', { replacements: { id: log.id, helpful: log.was_helpful, comment: log.feedback_comment } });
  console.log('PASS: local schema, public configured chips, deployed feedback persistence and foreign-session rejection. No contact or staff email was sent.');
})().catch((error) => { console.error('Widget API verification failed.', { name: error.name, database_code: error.parent?.code || null }); process.exitCode = 1; }).finally(() => db.close());
