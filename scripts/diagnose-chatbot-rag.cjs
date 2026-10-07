// Read-only diagnosis: SELECTs and the actual retrieval function only.
// No public chat request, provider request, quota reset, data update, or worker.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('ts-node/register/transpile-only');
const { sequelize } = require('../src/models');
const { QueryTypes } = require('sequelize');
const { buildChatContext } = require('../src/services/chatbot.service');
const { aiSettingsService } = require('../src/services/aiSettings.service');
const { AiChatLog } = require('../src/models/AiChatLog.model');
const { todayDateStringVietnam } = require('../src/utils/vietnamTime');
const { decryptSecret } = require('../src/utils/secretCrypto');

sequelize.options.logging = false;
const output = path.resolve(__dirname, '../../client/docs/ai-chat-logs-diagnosis.json');
const questions = [
  'Gói MXH100 giá bao nhiêu?',
  'Gói TK135 giá bao nhiêu? Có ưu đãi gì?',
  'Gói cước nào rẻ dưới 100.000đ?',
  'Cửa hàng gần tôi ở đâu?',
  'Gói cước nào rẻ?',
];
const placeholders = /\[\s*(?:ĐIỀN|XÁC\s*NHẬN|DIEN|XAC\s*NHAN|TODO|XXX)\s*[^\]]*\]/i;
function redact(value) {
  return String(value ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email đã che]')
    .replace(/(?:\+84|0)(?:[ .-]?\d){8,10}/g, '[số điện thoại đã che]');
}
function keyState(ciphertext) {
  if (!ciphertext) return 'not_stored';
  try { return decryptSecret(ciphertext) ? 'decryptable' : 'empty'; }
  catch { return 'not_decryptable'; }
}
const select = (sql, replacements) => sequelize.query(sql, {
  type: QueryTypes.SELECT, logging: false, replacements,
});

(async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/services/chatbot.service.ts'));
  const report = {
    recorded_at: new Date().toISOString(),
    scope: 'Configured local database; read-only SELECT + actual buildChatContext; no provider/public chat call.',
    pipeline_sha256: crypto.createHash('sha256').update(source).digest('hex'),
    retrieval: {
      method: 'SQL LIKE OR across normalized tokens; no embedding or similarity scoring',
      similarity_threshold: null,
      score: null,
      per_source_limit: 5,
      max_sources: 6,
      max_context_characters: 24000,
      package_order: 'price ASC',
      knowledge_order: 'updated_at DESC',
    },
  };
  try {
    const knowledge = await select('SELECT id,title,content,status FROM ai_knowledge_entries ORDER BY id');
    report.knowledge = {
      total: knowledge.length,
      active: knowledge.filter((row) => row.status === 'active').length,
      inactive: knowledge.filter((row) => row.status === 'inactive').length,
      placeholders: knowledge.filter((row) => placeholders.test(`${row.title}\n${row.content}`))
        .map((row) => ({ id: row.id, title: redact(row.title), status: row.status })),
    };
    report.packages = await select(`SELECT id,code,name,price,duration_value,duration_unit,
      data_desc,call_desc,sms_desc,sms_syntax,conditions,status,
      effective_from,effective_to,deleted_at FROM packages WHERE UPPER(code) IN ('MXH100','XMH100','TK135')
      OR UPPER(name) IN ('MXH100','TK135') OR LOWER(slug)='mxh100'`);
    report.package_counts = await select(`SELECT status,COUNT(*) total FROM packages
      WHERE deleted_at IS NULL GROUP BY status`);
    report.current_packages_under_100000 = await select(`SELECT code,name,price,duration_value,duration_unit FROM packages
      WHERE status='active' AND deleted_at IS NULL AND price<100000
      AND (effective_from IS NULL OR effective_from<=NOW())
      AND (effective_to IS NULL OR effective_to>=NOW()) ORDER BY price,code`);
    report.store_counts = await select('SELECT status,COUNT(*) total FROM stores GROUP BY status');
    report.stores = await select(`SELECT id,name,full_address,address,district,opening_hours,opening_hours_json,
      status FROM stores ORDER BY id`);
    const settings = await select(`SELECT \`key\`,value FROM settings WHERE \`key\` IN (:keys)`, {
      keys: ['hotline', 'contact_address', 'working_hours', 'footer_address', 'footer_working_hours',
        'ai_provider', 'ai_model', 'ai_daily_limit', 'ai_rag_enabled', 'ai_chatbot_enabled',
        'ai_profiles_enabled', 'ai_api_key_encrypted', 'ai_system_prompt', 'ai_fallback_message'],
    });
    const values = Object.fromEntries(settings.map((row) => [row.key, row.value]));
    report.settings = Object.fromEntries(settings.filter((row) => row.key !== 'ai_api_key_encrypted')
      .map((row) => [row.key, row.value]));
    report.legacy_key_state = keyState(values.ai_api_key_encrypted);
    const profiles = await select('SELECT config,api_key_encrypted FROM ai_profiles ORDER BY position,id');
    report.profiles = profiles.map((row) => {
      const profile = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
      return { provider: profile.provider, model: profile.model, enabled: profile.enabled,
        key_state: keyState(row.api_key_encrypted) };
    });
    report.chat_log_counts = await select(`SELECT COUNT(*) total,
      COUNT(DISTINCT session_id) conversations,SUM(flagged_for_review=1) flagged,
      SUM(ai_response LIKE '%Hiện chatbot chưa thể trả lời%') default_fallback,
      SUM(created_at>=DATE_SUB(NOW(),INTERVAL 1 DAY)) last_24_hours
      FROM ai_chat_logs`);
    report.chat_log_columns = (await select('SHOW COLUMNS FROM ai_chat_logs')).map((row) => row.Field);
    try {
      const resolved = await aiSettingsService.resolveProvider();
      report.resolve_provider_read_only = { success: Boolean(resolved.provider),
        model: values.ai_model, provider: values.ai_provider,
        prompt_has_hotline: resolved.prompt.includes(values.hotline || '__not_configured__'),
        no_provider_chat_invoked: true };
    } catch (error) {
      report.resolve_provider_read_only = { success: false, error_name: error?.name || 'Error',
        no_provider_chat_invoked: true };
    }
    try {
      // Query the same full model used for chatbot history, but never output its content.
      await AiChatLog.findAll({ order: [['created_at', 'DESC']], limit: 6, logging: false });
      report.full_model_history_select = { success: true, limit: 6 };
    } catch (error) {
      report.full_model_history_select = { success: false, error_name: error?.name || 'Error' };
    }
    const todayStart = new Date(`${todayDateStringVietnam()}T00:00:00+07:00`);
    const quota = Number(values.ai_daily_limit) > 0 ? Number(values.ai_daily_limit) : 20;
    report.today_quota = {
      day: todayDateStringVietnam(), limit: quota,
      ip_groups: await select(`SELECT COUNT(*) groups_total,COALESCE(MAX(n),0) highest_count,
        COALESCE(SUM(n>=:quota),0) groups_at_limit FROM
        (SELECT COUNT(*) n FROM ai_chat_logs WHERE created_at>=:todayStart GROUP BY ip_address) counts`,
      { todayStart, quota }),
      session_groups: await select(`SELECT COUNT(*) groups_total,COALESCE(MAX(n),0) highest_count,
        COALESCE(SUM(n>=:quota),0) groups_at_limit FROM
        (SELECT COUNT(*) n FROM ai_chat_logs WHERE created_at>=:todayStart GROUP BY session_id) counts`,
      { todayStart, quota }),
    };
    report.widget_migration_applied = (await select(`SELECT name FROM SequelizeMeta
      WHERE name='20261006000001-chatbot-widget.js'`)).length === 1;
    report.provider_call_summary = await select(`SELECT provider,model,purpose,error_code,COUNT(*) calls,
      MIN(created_at) first_at,MAX(created_at) last_at FROM ai_provider_calls
      WHERE created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)
      GROUP BY provider,model,purpose,error_code ORDER BY last_at DESC`);
    report.recent_provider_calls = await select(`SELECT provider,model,purpose,attempt,latency_ms,error_code,created_at
      FROM ai_provider_calls ORDER BY created_at DESC LIMIT 20`);
    report.fallback_by_day = await select(`SELECT DATE(created_at) day,COUNT(*) logs,
      SUM(ai_response LIKE '%Hiện chatbot chưa thể trả lời%') default_fallback,
      SUM(flagged_for_review=1) flagged FROM ai_chat_logs
      WHERE created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) GROUP BY DATE(created_at) ORDER BY day DESC`);
    report.retrieval_results = [];
    for (const question of questions) {
      const retrieved = await buildChatContext(question);
      const chunks = retrieved.text === 'Không tìm thấy dữ liệu liên quan trong hệ thống.' ? [] :
        retrieved.text.split(/\n\n(?=(?:Tri thức chi nhánh|Giải pháp|Gói cước|Cửa hàng|Tin tức|SIM đang có):)/);
      report.retrieval_results.push({
        question,
        chunk_count: chunks.length,
        highest_similarity_score: null,
        score_note: 'Không có score trong pipeline hiện tại; không tự tạo điểm.',
        chunks: chunks.map((text) => ({ title: redact(text.split('\n')[0]), text: redact(text), score: null })),
        sources: retrieved.sources.map((item) => ({ title: redact(item.title), href: item.href })),
      });
    }
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ output, ...report.knowledge,
      packages: report.packages, package_counts: report.package_counts,
      packages_under_100000: report.current_packages_under_100000,
      store_counts: report.store_counts,
      provider_call_summary: report.provider_call_summary,
      chat_log_counts: report.chat_log_counts,
      legacy_key_state: report.legacy_key_state,
      profiles: report.profiles,
      provider_resolution: report.resolve_provider_read_only,
      full_model_history_select: report.full_model_history_select,
      today_quota: report.today_quota,
      widget_migration_applied: report.widget_migration_applied,
      retrieval: report.retrieval_results.map(({ question, chunk_count, chunks }) => ({ question, chunk_count, chunks })),
    }, null, 2));
  } finally { await sequelize.close(); }
})().catch((error) => {
  console.error(`Read-only diagnosis failed: ${error?.name || 'Error'}`);
  process.exitCode = 1;
});
