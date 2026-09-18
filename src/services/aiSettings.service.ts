import { Setting } from '../models/Setting.model';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { decryptSecret, encryptSecret, maskSecret } from '../utils/secretCrypto';
import { AiChatParams, AiProviderName, createAiProvider } from './aiProvider.service';

const DEFAULT_PROMPT =
  'Bạn là trợ lý CSKH của MobiFone Sơn La. Chỉ trả lời dựa trên dữ liệu được cung cấp. Nếu không chắc, hãy đề nghị khách gọi hotline.';

async function values(): Promise<Record<string, string>> {
  const rows = await Setting.findAll({ where: { group: 'ai' } });
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function params(config: Record<string, string>): AiChatParams {
  return {
    temperature: Math.min(1, Math.max(0, Number(config.ai_temperature ?? 0.4) || 0.4)),
    maxTokens: Math.min(4000, Math.max(20, Number(config.ai_max_tokens ?? 500) || 500)),
    topP: Math.min(1, Math.max(0, Number(config.ai_top_p ?? 1) || 1)),
  };
}

export const aiSettingsService = {
  async getPublicConfig() {
    const config = await values();
    return {
      provider: config.ai_provider ?? 'anthropic',
      model: config.ai_model ?? env.ANTHROPIC_MODEL,
      enabled: config.ai_chatbot_enabled !== 'false' && config.ai_chatbot_enabled !== '0',
      daily_limit: Number(config.ai_daily_limit ?? 20),
      rag_enabled: config.ai_rag_enabled !== 'false' && config.ai_rag_enabled !== '0',
    };
  },

  async getAdminConfig() {
    const config = await values();
    const encrypted = config.ai_api_key_encrypted ?? null;
    return {
      provider: config.ai_provider ?? 'anthropic',
      model: config.ai_model ?? env.ANTHROPIC_MODEL,
      temperature: params(config).temperature,
      max_tokens: params(config).maxTokens,
      top_p: params(config).topP,
      system_prompt: config.ai_system_prompt ?? DEFAULT_PROMPT,
      daily_limit: Number(config.ai_daily_limit ?? 20),
      rag_enabled: config.ai_rag_enabled !== 'false' && config.ai_rag_enabled !== '0',
      enabled: config.ai_chatbot_enabled !== 'false' && config.ai_chatbot_enabled !== '0',
      has_api_key: Boolean(encrypted || env.ANTHROPIC_API_KEY),
      api_key_masked: encrypted
        ? maskSecret(encrypted)
        : env.ANTHROPIC_API_KEY
          ? maskSecret(env.ANTHROPIC_API_KEY)
          : null,
    };
  },

  async update(
    input: {
      provider: AiProviderName;
      model: string;
      api_key?: string;
      temperature: number;
      max_tokens: number;
      top_p: number;
      system_prompt: string;
      daily_limit: number;
      rag_enabled: boolean;
      enabled: boolean;
    },
    updatedBy: number,
  ) {
    const items = [
      ['ai_provider', input.provider],
      ['ai_model', input.model],
      ['ai_temperature', String(input.temperature)],
      ['ai_max_tokens', String(input.max_tokens)],
      ['ai_top_p', String(input.top_p)],
      ['ai_system_prompt', input.system_prompt],
      ['ai_daily_limit', String(input.daily_limit)],
      ['ai_rag_enabled', String(input.rag_enabled)],
      ['ai_chatbot_enabled', String(input.enabled)],
    ];
    if (input.api_key?.trim())
      items.push(['ai_api_key_encrypted', encryptSecret(input.api_key.trim())]);
    await Promise.all(
      items.map(([key, value]) =>
        Setting.upsert({ key, value, group: 'ai', updated_by: updatedBy }),
      ),
    );
    return this.getAdminConfig();
  },

  async testConnection(input: { provider: AiProviderName; model: string; api_key?: string }) {
    const config = await values();
    const encrypted = config.ai_api_key_encrypted;
    const apiKey =
      input.api_key?.trim() || (encrypted ? decryptSecret(encrypted) : env.ANTHROPIC_API_KEY);
    if (!apiKey) throw AppError.badRequest('Chưa cấu hình API key');
    try {
      await createAiProvider(input.provider, input.model, apiKey).testConnection({
        temperature: 0,
        maxTokens: 20,
        topP: 1,
      });
      return { ok: true, message: 'Kết nối provider thành công' };
    } catch {
      throw AppError.badRequest('Không thể kết nối provider. Kiểm tra model và API key.');
    }
  },

  async resolveProvider() {
    const config = await values();
    const provider = (config.ai_provider ?? 'anthropic') as AiProviderName;
    const model = config.ai_model ?? env.ANTHROPIC_MODEL;
    const key = config.ai_api_key_encrypted
      ? decryptSecret(config.ai_api_key_encrypted)
      : provider === 'anthropic'
        ? env.ANTHROPIC_API_KEY
        : '';
    if (!key) throw new Error('AI provider API key is not configured');
    return {
      provider: createAiProvider(provider, model, key),
      prompt: config.ai_system_prompt ?? DEFAULT_PROMPT,
      params: params(config),
      config,
    };
  },
};
