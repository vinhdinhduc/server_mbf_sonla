/* eslint-disable max-classes-per-file, no-await-in-loop, no-promise-executor-return, no-useless-constructor, no-empty-function */
import Anthropic from '@anthropic-ai/sdk';

export type AiProviderName = 'openai' | 'anthropic' | 'gemini';

export function providerErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number')
    return error.status;
  return undefined;
}

class ProviderRequestError extends Error {
  constructor(readonly status: number) {
    super(`AI provider request failed with status ${status}`);
  }
}

export interface AiChatParams {
  temperature: number;
  maxTokens: number;
  topP: number;
}

export interface AiProvider {
  chat(
    systemPrompt: string,
    context: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    params: AiChatParams,
  ): Promise<string>;
  testConnection(params: AiChatParams): Promise<void>;
}

function messagesWithHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
) {
  return [...history, { role: 'user' as const, content: userMessage }];
}

async function retry<T>(task: () => Promise<T>, attempts = 2): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const status = providerErrorStatus(error);
      if (status && status < 500 && ![408, 429].includes(status)) throw error;
      last = error;
      if (attempt + 1 < attempts)
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw last;
}

class AnthropicProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async chat(
    systemPrompt: string,
    context: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    params: AiChatParams,
  ) {
    const client = new Anthropic({ apiKey: this.apiKey, maxRetries: 0 });
    const response = await retry(() =>
      client.messages.create(
        {
          model: this.model,
          max_tokens: params.maxTokens,
          temperature: params.temperature,
          system: `${systemPrompt}\n\nContext du lieu noi bo:\n${context}`,
          messages: messagesWithHistory(history, userMessage),
        },
        { signal: AbortSignal.timeout(15_000) },
      ),
    );
    const block = response.content.find((item) => item.type === 'text');
    return block && 'text' in block ? block.text : '';
  }

  async testConnection(params: AiChatParams) {
    const reply = await this.chat('Reply with exactly OK.', '', [], 'Connection test', {
      ...params,
      maxTokens: Math.min(params.maxTokens, 20),
    });
    if (!reply.trim()) throw new Error('AI provider returned an empty reply');
  }
}

class OpenAiCompatibleProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
  ) {}

  private async request(body: Record<string, unknown>) {
    return retry(async () => {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new ProviderRequestError(response.status);
      }
      return response.json() as Promise<{ choices?: Array<{ message?: { content?: string } }> }>;
    });
  }

  async chat(
    systemPrompt: string,
    context: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    params: AiChatParams,
  ) {
    const result = await this.request({
      model: this.model,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      top_p: params.topP,
      messages: [
        { role: 'system', content: `${systemPrompt}\n\nContext du lieu noi bo:\n${context}` },
        ...messagesWithHistory(history, userMessage),
      ],
    });
    return result.choices?.[0]?.message?.content ?? '';
  }

  async testConnection(params: AiChatParams) {
    const reply = await this.chat('Reply with exactly OK.', '', [], 'Connection test', {
      ...params,
      maxTokens: Math.min(params.maxTokens, 20),
    });
    if (!reply.trim()) throw new Error('AI provider returned an empty reply');
  }
}

export function createAiProvider(
  provider: AiProviderName,
  model: string,
  apiKey: string,
): AiProvider {
  if (provider === 'anthropic') return new AnthropicProvider(apiKey, model);
  if (provider === 'openai')
    return new OpenAiCompatibleProvider(apiKey, model, 'https://api.openai.com/v1');
  if (provider === 'gemini')
    return new OpenAiCompatibleProvider(
      apiKey,
      model,
      'https://generativelanguage.googleapis.com/v1beta/openai',
    );
  throw new Error(`Unsupported AI provider: ${provider}`);
}
