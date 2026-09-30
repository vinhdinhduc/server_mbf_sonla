/* eslint-disable max-classes-per-file, no-await-in-loop, no-promise-executor-return, no-useless-constructor, no-empty-function */
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { AiPrice, AiUsage, aiUsageService, tokenCount } from './aiUsage.service';

export type AiProviderName = 'openai' | 'anthropic' | 'gemini';

export function providerErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number')
    return error.status;
  return undefined;
}

export function providerErrorCode(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  if (
    ['TimeoutError', 'AbortError', 'APIUserAbortError', 'APIConnectionTimeoutError'].includes(name)
  )
    return 'timeout';
  const status = providerErrorStatus(error);
  if (status === 408 || status === 504) return 'timeout';
  if (status === 401) return 'invalid_key';
  if (status === 403) return 'access_denied';
  if (status === 404) return 'model_not_found';
  if (status === 429) return 'quota_or_rate_limit';
  if (status === 400 || status === 422) return 'invalid_request';
  if (error instanceof EmptyResponseError) return 'empty_response';
  return status && status >= 500 ? 'provider_unavailable' : 'connection_error';
}

class ProviderRequestError extends Error {
  constructor(readonly status: number) {
    super('AI provider request failed');
  }
}

class EmptyResponseError extends Error {
  constructor(readonly result: AiChatResult) {
    super('AI provider returned an empty reply');
  }
}

export interface AiChatParams {
  temperature: number;
  maxTokens: number;
  topP: number;
}

export interface AiChatResult {
  text: string;
  usage: AiUsage;
}

export interface AiProvider {
  chat(
    systemPrompt: string,
    context: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    params: AiChatParams,
  ): Promise<AiChatResult>;
  testConnection(params: AiChatParams): Promise<void>;
}

type History = Array<{ role: 'user' | 'assistant'; content: string }>;
const TIMEOUT_MS = 20_000;

abstract class RecordedProvider implements AiProvider {
  constructor(
    protected readonly apiKey: string,
    protected readonly model: string,
    private readonly name: AiProviderName,
    private readonly price?: AiPrice,
  ) {}

  protected abstract request(
    system: string,
    history: History,
    params: AiChatParams,
    signal: AbortSignal,
  ): Promise<AiChatResult>;

  private async run(
    system: string,
    history: History,
    params: AiChatParams,
    purpose: 'chat' | 'connection_test',
  ): Promise<AiChatResult> {
    const requestId = randomUUID();
    // One deadline for all attempts, including response body consumption.
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const started = Date.now();
      let result: AiChatResult | undefined;
      let failure: unknown;
      try {
        signal.throwIfAborted();
        result = await this.request(system, history, params, signal);
        if (!result.text.trim()) throw new EmptyResponseError(result);
      } catch (error) {
        failure = signal.aborted ? signal.reason : error;
      }
      const errorCode = failure ? providerErrorCode(failure) : null;
      try {
        await aiUsageService.record({
          requestId,
          attempt,
          purpose,
          provider: this.name,
          model: this.model,
          inputTokens: result?.usage.inputTokens ?? null,
          outputTokens: result?.usage.outputTokens ?? null,
          latencyMs: Date.now() - started,
          errorCode,
          price: this.price,
        });
      } catch {
        // Do not turn a paid, successful answer into another paid request on DB failure.
        console.error('AI usage write failed');
      }
      if (!failure) return result!;
      const status = providerErrorStatus(failure);
      if (
        attempt === 2 ||
        signal.aborted ||
        errorCode === 'empty_response' ||
        (status && status < 500 && ![408, 429].includes(status))
      )
        throw failure;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('AI request failed');
  }

  chat(
    systemPrompt: string,
    context: string,
    history: History,
    userMessage: string,
    params: AiChatParams,
  ) {
    return this.run(
      `${systemPrompt}\n\nContext du lieu noi bo:\n${context}`,
      [...history, { role: 'user', content: userMessage }],
      params,
      'chat',
    );
  }

  async testConnection(params: AiChatParams) {
    await this.run(
      'Reply with exactly OK.',
      [{ role: 'user', content: 'Connection test' }],
      params,
      'connection_test',
    );
  }
}

class AnthropicProvider extends RecordedProvider {
  protected async request(
    system: string,
    history: History,
    params: AiChatParams,
    signal: AbortSignal,
  ): Promise<AiChatResult> {
    const client = new Anthropic({ apiKey: this.apiKey, maxRetries: 0 });
    const response = await client.messages.create(
      {
        model: this.model,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        system,
        messages: history,
      },
      { signal },
    );
    return {
      text: response.content
        .filter((item) => item.type === 'text')
        .map((item) => ('text' in item ? item.text : ''))
        .join('\n'),
      usage: {
        inputTokens: tokenCount(response.usage?.input_tokens),
        outputTokens: tokenCount(response.usage?.output_tokens),
      },
    };
  }
}

class OpenAiCompatibleProvider extends RecordedProvider {
  constructor(
    apiKey: string,
    model: string,
    name: AiProviderName,
    private readonly baseUrl: string,
    price?: AiPrice,
  ) {
    super(apiKey, model, name, price);
  }

  protected async request(
    system: string,
    history: History,
    params: AiChatParams,
    signal: AbortSignal,
  ): Promise<AiChatResult> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        top_p: params.topP,
        messages: [{ role: 'system', content: system }, ...history],
      }),
      signal,
      redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ProviderRequestError(response.status);
    }
    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: result.choices?.[0]?.message?.content ?? '',
      usage: {
        inputTokens: tokenCount(result.usage?.prompt_tokens),
        outputTokens: tokenCount(result.usage?.completion_tokens),
      },
    };
  }
}

export function createAiProvider(
  provider: AiProviderName,
  model: string,
  apiKey: string,
  price?: AiPrice,
): AiProvider {
  if (provider === 'anthropic') return new AnthropicProvider(apiKey, model, provider, price);
  if (provider === 'openai')
    return new OpenAiCompatibleProvider(
      apiKey,
      model,
      provider,
      'https://api.openai.com/v1',
      price,
    );
  if (provider === 'gemini')
    return new OpenAiCompatibleProvider(
      apiKey,
      model,
      provider,
      'https://generativelanguage.googleapis.com/v1beta/openai',
      price,
    );
  throw new Error('Unsupported AI provider');
}
