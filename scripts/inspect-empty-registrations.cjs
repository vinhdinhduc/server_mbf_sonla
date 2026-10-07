const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });
(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, connectTimeout: 8000 });
  const [rows] = await db.query(`SELECT g.id,g.code,g.status,g.total_amount,g.created_at,COUNT(i.id) item_count,
    (g.customer_name REGEXP 'test|kiểm thử|demo|mẫu|e2e') name_test_hint,
    (g.email REGEXP 'example\\.|test|e2e') email_test_hint,
    (g.idempotency_key REGEXP 'test|e2e') key_test_hint,
    (SELECT COUNT(*) FROM registration_events e WHERE e.registration_id=g.id) event_count
    FROM registration_groups g LEFT JOIN registration_items i ON i.registration_group_id=g.id
    GROUP BY g.id HAVING item_count=0 ORDER BY g.id DESC LIMIT 30`);
  console.log(JSON.stringify(rows));
  await db.end();
})().catch(error => { console.error(error.code || 'DB_READ_FAILED'); process.exitCode=1; });
