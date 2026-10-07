// Five diagnostic questions through the existing stored admin/provider flow.
// Records ordinary provider usage; never calls public chat or creates chat logs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('ts-node/register/transpile-only');
const { sequelize } = require('../src/models');
const { QueryTypes } = require('sequelize');
const { buildChatContext } = require('../src/services/chatbot.service');
const { aiSettingsService } = require('../src/services/aiSettings.service');
const { resolveProfiles } = require('../src/services/llm/profiles');
const { providerErrorCode, providerErrorStatus } = require('../src/services/aiProvider.service');

sequelize.options.logging = false;
const output = path.resolve(__dirname, '../../client/docs/ai-chat-logs-provider-probe.json');
const questions = [
  'Gói MXH100 giá bao nhiêu?',
  'Gói TK135 giá bao nhiêu? Có ưu đãi gì?',
  'Gói cước nào rẻ dưới 100.000đ?',
  'Cửa hàng gần tôi ở đâu?',
  'Gói cước nào rẻ?',
];
function redact(value) {
  return String(value ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email đã che]')
    .replace(/(?:\+84|0)(?:[ .-]?\d){8,10}/g, '[số điện thoại đã che]');
}
const select = (sql, replacements) => sequelize.query(sql, {
  type: QueryTypes.SELECT, logging: false, replacements,
});

(async () => {
  const startedAt = new Date();
  const report = {
    recorded_at: startedAt.toISOString(),
    scope: 'Five requested internal admin/provider probes with stored prompt/profile/params and real retrieval. Ordinary provider usage is recorded; no public chat, chat logs, sessions, IP changes, quota resets, or configuration/data edits.',
    question_count: questions.length,
    history: 'empty; each question is independent',
    results: [],
  };
  try {
    report.chat_log_count_before = Number((await select('SELECT COUNT(*) n FROM ai_chat_logs'))[0].n);
    const resolved = await aiSettingsService.resolveProvider();
    report.prompt_sha256 = crypto.createHash('sha256').update(resolved.prompt).digest('hex');
    report.rag_enabled = !['false', '0'].includes(resolved.config.ai_rag_enabled);
    report.provider_config = resolved.config.ai_profiles_enabled === 'true'
      ? (await resolveProfiles(resolved.config)).map((profile) => ({
        provider: profile.provider, model: profile.model,
        temperature: profile.temperature, max_tokens: profile.max_tokens, top_p: profile.top_p,
      }))
      : [{ provider: resolved.config.ai_provider, model: resolved.config.ai_model, ...resolved.params }];
    for (const question of questions) {
      const started = Date.now();
      const context = report.rag_enabled
        ? await buildChatContext(question)
        : { text: 'Không sử dụng dữ liệu bổ sung.', sources: [] };
      let item;
      try {
        const result = await resolved.provider.chat(resolved.prompt, context.text, [], question, resolved.params);
        item = { question, status: 'answered', provider: result.provider, model: result.model,
          latency_ms: Date.now() - started, reply: redact(result.text), usage: result.usage,
          sources: context.sources.map((source) => ({ title: redact(source.title), href: source.href })) };
      } catch (error) {
        // Never persist provider error messages, request bodies, or API keys.
        item = { question, status: 'provider_error', latency_ms: Date.now() - started,
          error_code: providerErrorCode(error), http_status: providerErrorStatus(error) ?? null,
          error_name: error?.name || 'Error',
          network_code: typeof error?.cause?.code === 'string' ? error.cause.code : null };
      }
      report.results.push(item);
      fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify(item));
    }
    report.chat_log_count_after = Number((await select('SELECT COUNT(*) n FROM ai_chat_logs'))[0].n);
    report.provider_call_records = await select(`SELECT provider,model,purpose,attempt,error_code,latency_ms,
      input_tokens,output_tokens FROM ai_provider_calls WHERE created_at>=:startedAt ORDER BY created_at,attempt`,
    { startedAt });
    report.completed_at = new Date().toISOString();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ output, answered: report.results.filter((item) => item.status === 'answered').length,
      provider_errors: report.results.filter((item) => item.status === 'provider_error').length,
      chat_logs_unchanged: report.chat_log_count_before === report.chat_log_count_after,
      provider_usage_records: report.provider_call_records.length }));
  } finally { await sequelize.close(); }
})().catch((error) => {
  console.error(`Admin diagnostic probe failed: ${error?.name || 'Error'}`);
  process.exitCode = 1;
});
