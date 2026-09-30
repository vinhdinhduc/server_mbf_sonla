/* eslint-disable max-classes-per-file, no-await-in-loop, no-promise-executor-return, no-useless-constructor, no-empty-function */
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { AiPrice, AiUsage, aiUsageService, tokenCount } from './aiUsage.service';
import { getProvider, resolveEndpoint, ProviderDefinition } from './llm/registry/providers';
import { executeAdapter, ProviderOptions, ToolCall, ToolDefinition } from './llm/adapters';
import { validateBaseUrl } from './llm/safeHttp';

export type AiProviderName = string;

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
  tools?: ToolDefinition[];
  onText?: (text: string) => void;
}

export interface AiChatResult {
  text: string;
  usage: AiUsage;
  tool_calls?: ToolCall[];
  model?: string;
  provider?: string;
}

export interface AiProvider {
  chat(
    systemPrompt: string,
    context: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    params: AiChatParams,
  ): Promise<AiChatResult>;
  testConnection(params: AiChatParams): Promise<AiChatResult | void>;
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
        if (!result.text.trim() && !result.tool_calls?.length) throw new EmptyResponseError(result);
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
      if (!failure) return { ...result!, model: result!.model || this.model, provider: this.name };
      const status = providerErrorStatus(failure);
      if (
        attempt === 2 ||
        Boolean(params.onText) ||
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
    return this.run(
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
    if (params.onText || params.tools?.length) {
      return executeAdapter(getProvider('anthropic'), 'https://api.anthropic.com/v1', this.apiKey,
        this.model, system, history, params, signal);
    }
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
      model: response.model,
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
    private readonly definition: ProviderDefinition = getProvider(name),
    private readonly custom = false,
  ) {
    super(apiKey, model, name, price);
  }

  protected async request(
    system: string,
    history: History,
    params: AiChatParams,
    signal: AbortSignal,
  ): Promise<AiChatResult> {
    return executeAdapter(this.definition, this.baseUrl, this.apiKey, this.model, system, history, params, signal, this.custom);
  }
}

export function createAiProvider(
  provider: AiProviderName,
  model: string,
  apiKey: string,
  price?: AiPrice,
  options: ProviderOptions = {},
): AiProvider {
  if (provider === 'anthropic') return new AnthropicProvider(apiKey, model, provider, price);
  const resolved = resolveEndpoint(provider, options.endpoint_id, options.base_url);
  if (provider === 'custom') validateBaseUrl(resolved.baseUrl);
  const routedModel = provider === 'huggingface' && options.host && options.host !== 'auto'
    ? `${model.split(':')[0]}:${options.host}` : model;
  return new OpenAiCompatibleProvider(apiKey, routedModel, provider, resolved.baseUrl, price, resolved.definition, provider === 'custom');
}
