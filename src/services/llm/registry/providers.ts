/** Provider metadata only. Never put credentials in this registry. */
export interface ModelDefinition {
  id: string;
  label: string;
  group: 'recommended' | 'fast' | 'powerful' | 'other';
  contextWindow: number | null;
  maxOutputTokens: number | null;
  priceInPer1M: number | null;
  priceOutPer1M: number | null;
  tools: boolean | null;
  streaming: boolean | null;
  recommended: boolean;
  deprecated: boolean;
  verified: boolean;
  source: 'static' | 'api';
  endpointId?: string;
}
export interface ProviderDefinition {
  id: string;
  name: string;
  tagline: string;
  category: 'native' | 'openai_compatible' | 'aggregator' | 'fast_inference';
  adapter: 'anthropic' | 'gemini' | 'cohere' | 'ai21' | 'openai_compatible';
  endpoints: Array<{ id: string; label: string; baseUrl: string; verified: boolean; hostProvider?: string; disabled?: boolean }>;
  defaultEndpoint: string;
  keyHelp: { url: string; placeholder: string; regex?: string };
  capabilities: { tools: boolean | null; streaming: boolean | null; vision: boolean | null; jsonMode: boolean | null };
  models: ModelDefinition[];
  extraFields: Array<{ id: string; label: string; placeholder: string }>;
  verified: boolean;
  checkedAt: string;
  sources: string[];
  modelListPath?: string;
  auth: 'bearer' | 'anthropic' | 'gemini';
  flags: { maxTokens: 'max_tokens' | 'max_completion_tokens'; toolChoice: boolean; streamUsage: boolean; inputUsage: string; outputUsage: string };
}

export function model(id: string, details: Partial<ModelDefinition> = {}): ModelDefinition {
  return { id, label: id, group: 'other', contextWindow: null, maxOutputTokens: null,
    priceInPer1M: null, priceOutPer1M: null, tools: null, streaming: null,
    recommended: false, deprecated: false, verified: false, source: 'static', ...details };
}
function provider(id: string, name: string, tagline: string, baseUrl: string, source: string,
  details: Partial<ProviderDefinition> = {}): ProviderDefinition {
  return { id, name, tagline, category: 'openai_compatible', adapter: 'openai_compatible',
    endpoints: [{ id: 'global', label: 'Quốc tế', baseUrl, verified: false }], defaultEndpoint: 'global',
    keyHelp: { url: source, placeholder: 'Nhập API key của nhà cung cấp' },
    capabilities: { tools: null, streaming: null, vision: null, jsonMode: null },
    models: [], extraFields: [], verified: false, checkedAt: '2026-09-30', sources: [source], auth: 'bearer',
    flags: { maxTokens: 'max_tokens', toolChoice: true, streamUsage: false, inputUsage: 'prompt_tokens', outputUsage: 'completion_tokens' },
    ...details };
}
const full = { tools: true, streaming: true, vision: true, jsonMode: true };
const endpoint = (id: string, label: string, baseUrl: string, verified = false) => ({ id, label, baseUrl, verified });

export const providers: ProviderDefinition[] = [
  // Checked 2026-09-30: https://platform.claude.com/docs/en/api/overview and /en/about-claude/pricing.
  provider('anthropic', 'Claude (Anthropic)', 'Trợ lý hội thoại và phân tích tài liệu', 'https://api.anthropic.com/v1', 'https://platform.claude.com/docs/en/api/overview', {
    adapter: 'anthropic', category: 'native', auth: 'anthropic', modelListPath: '/models', capabilities: full,
    keyHelp: { url: 'https://platform.claude.com/settings/keys', placeholder: 'sk-ant-…' },
    models: [model('claude-haiku-4-5', { recommended: true, group: 'recommended', tools: true, streaming: true, priceInPer1M: 1, priceOutPer1M: 5, verified: true })],
    sources: ['https://platform.claude.com/docs/en/api/overview', 'https://platform.claude.com/docs/en/about-claude/pricing'],
  }),
  // Checked 2026-09-30: https://developers.openai.com/api/docs/models/gpt-4.1-mini (standard text rates).
  provider('openai', 'OpenAI', 'Hội thoại, hình ảnh và gọi công cụ', 'https://api.openai.com/v1', 'https://developers.openai.com/api/reference/overview', {
    category: 'native', capabilities: full, modelListPath: '/models',
    keyHelp: { url: 'https://platform.openai.com/api-keys', placeholder: 'sk-…' },
    models: [model('gpt-4.1-mini', { group: 'recommended', recommended: true, contextWindow: 1047576, maxOutputTokens: 32768, priceInPer1M: 0.4, priceOutPer1M: 1.6, tools: true, streaming: true, verified: true })],
    flags: { maxTokens: 'max_completion_tokens', toolChoice: true, streamUsage: true, inputUsage: 'prompt_tokens', outputUsage: 'completion_tokens' },
    sources: ['https://developers.openai.com/api/reference/overview', 'https://developers.openai.com/api/docs/models/gpt-4.1-mini'],
  }),
  // Checked 2026-09-30: https://ai.google.dev/api/generate-content and /api/models; prices not confirmed.
  provider('gemini', 'Google Gemini', 'Kết hợp văn bản và dữ liệu đa phương tiện', 'https://generativelanguage.googleapis.com/v1beta', 'https://ai.google.dev/api/generate-content', {
    adapter: 'gemini', category: 'native', auth: 'gemini', modelListPath: '/models', capabilities: full,
    keyHelp: { url: 'https://aistudio.google.com/apikey', placeholder: 'AIza…' },
  }),
  // Checked 2026-09-30: https://api-docs.deepseek.com/quick_start/pricing/; peak/off-peak pricing cannot fit a single rate.
  provider('deepseek', 'DeepSeek', 'Suy luận và lập trình với ngữ cảnh dài', 'https://api.deepseek.com', 'https://api-docs.deepseek.com/quick_start/pricing/', {
    modelListPath: '/models', capabilities: full, models: [model('deepseek-flash', { tools: true, streaming: true, contextWindow: 1000000, recommended: true, group: 'recommended' }), model('deepseek-v4-pro', { tools: true, group: 'powerful' })],
  }),
  // Checked 2026-09-30: https://docs.mistral.ai/resources/migration-guides; prices not confirmed.
  provider('mistral', 'Mistral', 'Model đa ngôn ngữ cho công việc hằng ngày', 'https://api.mistral.ai/v1', 'https://docs.mistral.ai/resources/migration-guides', {
    modelListPath: '/models', models: [model('mistral-small-latest', { group: 'fast' }), model('mistral-large-latest', { group: 'powerful' })],
  }),
  // Checked 2026-09-30: https://docs.x.ai/developers/pricing; long-context pricing varies, left null.
  provider('xai', 'Grok (xAI)', 'Hội thoại và suy luận từ xAI', 'https://api.x.ai/v1', 'https://docs.x.ai/developers/pricing', {
    modelListPath: '/models', models: [model('grok-4.6', { contextWindow: 500000 })],
  }),
  // Checked 2026-09-30: https://platform.kimi.ai/docs/guide/migrating-from-openai-to-kimi. China URL/pricing pending verification.
  provider('moonshot', 'Kimi (Moonshot)', 'Đọc hiểu và xử lý hội thoại dài', 'https://api.moonshot.ai/v1', 'https://platform.kimi.ai/docs/guide/migrating-from-openai-to-kimi', {
    modelListPath: '/models', endpoints: [endpoint('global', 'Quốc tế', 'https://api.moonshot.ai/v1', true), endpoint('china', 'Trung Quốc', 'https://api.moonshot.cn/v1')],
  }),
  // Checked 2026-09-30: https://dev.meta.ai/docs/overview now documents Muse, not Llama. Direct legacy Llama is disabled pending verification.
  provider('llama', 'Llama (Meta)', 'Chọn đơn vị lưu trữ model Llama của bạn', 'https://api.groq.com/openai/v1', 'https://dev.meta.ai/docs/overview', {
    category: 'aggregator', defaultEndpoint: 'groq', modelListPath: '/models', endpoints: [
      { ...endpoint('meta', 'Meta Llama API — cần xác minh', 'https://api.llama.com/v1'), disabled: true },
      { ...endpoint('groq', 'Groq', 'https://api.groq.com/openai/v1', true), hostProvider: 'groq' },
      { ...endpoint('together', 'Together AI', 'https://api.together.ai/v1', true), hostProvider: 'together' },
      { ...endpoint('fireworks', 'Fireworks AI', 'https://api.fireworks.ai/inference/v1'), hostProvider: 'fireworks' },
      { ...endpoint('deepinfra', 'DeepInfra', 'https://api.deepinfra.com/v1/openai', true), hostProvider: 'deepinfra' },
    ],
  }),
  // Checked 2026-09-30: https://openrouter.ai/docs/quickstart; live API supplies per-model pricing.
  provider('openrouter', 'OpenRouter', 'Một tài khoản, nhiều dòng model', 'https://openrouter.ai/api/v1', 'https://openrouter.ai/docs/quickstart', { category: 'aggregator', modelListPath: '/models' }),
  // Checked 2026-09-30: https://docs.together.ai/docs/inference/openai-compatibility; prices pending.
  provider('together', 'Together AI', 'Danh mục model mở cho ứng dụng AI', 'https://api.together.ai/v1', 'https://docs.together.ai/docs/inference/openai-compatibility', { category: 'aggregator', modelListPath: '/models', models: [model('MiniMaxAI/MiniMax-M3')] }),
  // Checked 2026-09-30: https://docs.fireworks.ai/api-reference/post-chatcompletions; model/prices pending.
  provider('fireworks', 'Fireworks AI', 'Triển khai model mở trên hạ tầng chuyên dụng', 'https://api.fireworks.ai/inference/v1', 'https://docs.fireworks.ai/api-reference/post-chatcompletions', { category: 'aggregator', modelListPath: '/models' }),
  // Checked 2026-09-30: https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview; Sonar compatibility/prices require review.
  provider('perplexity', 'Perplexity', 'Hội thoại với khả năng tìm kiếm thông tin', 'https://api.perplexity.ai', 'https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview', { models: [model('sonar', { tools: false })], capabilities: { tools: false, streaming: true, vision: null, jsonMode: null } }),
  // Checked 2026-09-30: https://docs.cohere.com/v2/reference/chat and https://docs.cohere.com/docs/command-a.
  provider('cohere', 'Cohere', 'Tra cứu tri thức và trợ lý doanh nghiệp', 'https://api.cohere.com', 'https://docs.cohere.com/v2/reference/chat', {
    adapter: 'cohere', category: 'native', modelListPath: '/v1/models',
    models: [model('command-a-03-2025', { contextWindow: 256000, maxOutputTokens: 8000, priceInPer1M: 2.5, priceOutPer1M: 10, tools: true, streaming: true, verified: true, group: 'recommended', recommended: true })],
    sources: ['https://docs.cohere.com/v2/reference/chat', 'https://docs.cohere.com/docs/command-a'],
  }),
  // Checked 2026-09-30: https://docs.ai21.com/docs/jamba-foundation-models. API reference unavailable; all metadata unverified.
  provider('ai21', 'AI21 (Jamba)', 'Xử lý tài liệu và ngữ cảnh dài', 'https://api.ai21.com/studio/v1', 'https://docs.ai21.com/docs/jamba-foundation-models', { adapter: 'ai21', category: 'native' }),
  // Checked 2026-09-30: https://docs.z.ai/guides/overview/quick-start. China URL and prices pending.
  provider('zhipu', 'Zhipu AI (GLM)', 'Dòng GLM cho hội thoại và suy luận', 'https://api.z.ai/api/paas/v4', 'https://docs.z.ai/guides/overview/quick-start', {
    models: [model('glm-5.3')], endpoints: [endpoint('global', 'Quốc tế (Z.AI)', 'https://api.z.ai/api/paas/v4', true), endpoint('china', 'Trung Quốc (BigModel)', 'https://open.bigmodel.cn/api/paas/v4')],
  }),
  // Checked 2026-09-30: https://platform.minimax.io/docs/api-reference/text-openai-api; China URL and prices pending.
  provider('minimax', 'MiniMax', 'Model hội thoại và lập trình đa ngôn ngữ', 'https://api.minimax.io/v1', 'https://platform.minimax.io/docs/api-reference/text-openai-api', {
    models: [model('MiniMax-M3', { tools: true, streaming: true })], endpoints: [endpoint('global', 'Quốc tế', 'https://api.minimax.io/v1'), endpoint('china', 'Trung Quốc', 'https://api.minimaxi.com/v1')],
    flags: { maxTokens: 'max_completion_tokens', toolChoice: true, streamUsage: true, inputUsage: 'prompt_tokens', outputUsage: 'completion_tokens' },
  }),
  // Checked 2026-09-30: https://docs.deepinfra.com/chat/overview; prices pending.
  provider('deepinfra', 'DeepInfra', 'Truy cập nhiều model mở qua một API', 'https://api.deepinfra.com/v1/openai', 'https://docs.deepinfra.com/chat/overview', { category: 'aggregator', modelListPath: '/models', models: [model('deepseek-ai/DeepSeek-V4-Flash-0731')] }),
  // Checked 2026-09-30: https://inference-docs.cerebras.ai/quickstart; prices pending.
  provider('cerebras', 'Cerebras', 'Phản hồi nhanh trên hạ tầng Cerebras', 'https://api.cerebras.ai/v1', 'https://inference-docs.cerebras.ai/quickstart', { category: 'fast_inference', modelListPath: '/models', models: [model('qwen-3.8-27b')] }),
  // Checked 2026-09-30: https://console.groq.com/docs/openai and /docs/models; live listing preferred.
  provider('groq', 'Groq', 'Tối ưu độ trễ cho hội thoại trực tiếp', 'https://api.groq.com/openai/v1', 'https://console.groq.com/docs/openai', { category: 'fast_inference', modelListPath: '/models' }),
  // Checked 2026-09-30: https://docs.siliconflow.com/en/userguide/quickstart. China endpoint/prices pending.
  provider('siliconflow', 'SiliconFlow', 'Danh mục model mở tại nhiều khu vực', 'https://api.siliconflow.com/v1', 'https://docs.siliconflow.com/en/userguide/quickstart', {
    category: 'aggregator', modelListPath: '/models', endpoints: [endpoint('global', 'Quốc tế', 'https://api.siliconflow.com/v1', true), endpoint('china', 'Trung Quốc', 'https://api.siliconflow.cn/v1')],
  }),
  // Checked 2026-09-30: https://docs.api.nvidia.com/nim/reference/meta-llama-3_1-8b-infer; hosted NIM only, price unknown.
  provider('nvidia', 'NVIDIA NIM', 'API model trên hạ tầng NVIDIA', 'https://integrate.api.nvidia.com/v1', 'https://docs.api.nvidia.com/nim/reference/meta-llama-3_1-8b-infer', { modelListPath: '/models', models: [model('meta/llama-3.1-8b-instruct', { maxOutputTokens: 4096, streaming: true })] }),
  // Checked 2026-09-30: https://docs.sambanova.ai/docs/en/integrations/vscode and /get-started/quickstart; prices pending.
  provider('sambanova', 'SambaNova Cloud', 'Suy luận nhanh cho các model mở', 'https://api.sambanova.ai/v1', 'https://docs.sambanova.ai/docs/en/integrations/vscode', { category: 'fast_inference', modelListPath: '/models', models: [model('Meta-Llama-3.3-70B-Instruct')] }),
  // Checked 2026-09-30: https://huggingface.co/docs/inference-providers/tasks/chat-completion. Routing uses model:host suffix.
  provider('huggingface', 'Hugging Face', 'Chọn model và đơn vị chạy phía sau', 'https://router.huggingface.co/v1', 'https://huggingface.co/docs/inference-providers/tasks/chat-completion', {
    category: 'aggregator', modelListPath: '/models', keyHelp: { url: 'https://huggingface.co/settings/tokens', placeholder: 'hf_…' },
    extraFields: [{ id: 'host', label: 'Đơn vị chạy model', placeholder: 'auto hoặc tên host, ví dụ baseten' }], models: [model('zai-org/GLM-5.3')],
  }),
  // User supplied endpoint; always validated and DNS-pinned by safeHttp.ts. No price assumptions.
  provider('custom', 'Tùy chỉnh', 'Kết nối API tương thích OpenAI của bạn', '', 'https://developers.openai.com/api/reference/overview', { modelListPath: '/models', endpoints: [], defaultEndpoint: '' }),
];

export function getProvider(id: string): ProviderDefinition {
  const found = providers.find((item) => item.id === id);
  if (!found) throw new Error('Nhà cung cấp không hợp lệ');
  return found;
}
export function resolveEndpoint(id: string, endpointId?: string, baseUrl?: string) {
  const definition = getProvider(id);
  if (id === 'custom') return { definition, baseUrl: baseUrl || '' };
  const selected = definition.endpoints.find((item) => item.id === (endpointId || definition.defaultEndpoint));
  if (!selected || selected.disabled) throw new Error('Endpoint chưa khả dụng. Vui lòng chọn đơn vị khác.');
  return { definition: selected.hostProvider ? getProvider(selected.hostProvider) : definition, baseUrl: selected.baseUrl };
}
