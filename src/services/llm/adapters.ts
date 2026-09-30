import { randomUUID } from 'crypto';
import type { AiChatParams, AiChatResult } from '../aiProvider.service';
import { tokenCount } from '../aiUsage.service';
import { ProviderDefinition } from './registry/providers';
import { customFetch, readJson } from './safeHttp';

export interface ToolCall { id: string; name: string; arguments: string }
export interface ToolDefinition { name: string; description: string; parameters: Record<string, unknown> }
export interface ProviderOptions { endpoint_id?: string; base_url?: string; host?: string }
export class ProviderHttpError extends Error {
  constructor(readonly status: number) { super('Không thể kết nối nhà cung cấp AI'); }
}
export function authHeaders(definition: ProviderDefinition, apiKey: string): Record<string, string> {
  if (definition.auth === 'anthropic') return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' };
  if (definition.auth === 'gemini') return { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' };
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
}
export function normalizeResponse(def: ProviderDefinition, data: any): AiChatResult {
  let text = '';
  let toolCalls: ToolCall[] = [];
  let input: unknown;
  let output: unknown;
  const calls = (items: any[] = []) => items.map((item) => ({ id: item.id || randomUUID(), name: item.function?.name || '', arguments: item.function?.arguments || '{}' }));
  switch (def.adapter) {
    case 'anthropic':
      text = (data.content || []).filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
      toolCalls = (data.content || []).filter((p: any) => p.type === 'tool_use').map((p: any) => ({ id: p.id, name: p.name, arguments: JSON.stringify(p.input) }));
      input = data.usage?.input_tokens; output = data.usage?.output_tokens; break;
    case 'gemini': {
      const parts = data.candidates?.[0]?.content?.parts || [];
      text = parts.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join('');
      toolCalls = parts.filter((p: any) => p.functionCall).map((p: any) => ({ id: p.functionCall.id || randomUUID(), name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args || {}) }));
      input = data.usageMetadata?.promptTokenCount;
      const visible = tokenCount(data.usageMetadata?.candidatesTokenCount);
      output = visible === null ? null : visible + (tokenCount(data.usageMetadata?.thoughtsTokenCount) || 0);
      break;
    }
    case 'cohere':
      text = (data.message?.content || []).map((p: any) => p.text || '').join('');
      toolCalls = calls(data.message?.tool_calls);
      input = data.usage?.billed_units?.input_tokens; output = data.usage?.billed_units?.output_tokens; break;
    default:
      text = data.choices?.[0]?.message?.content || '';
      toolCalls = calls(data.choices?.[0]?.message?.tool_calls);
      input = data.usage?.[def.flags.inputUsage]; output = data.usage?.[def.flags.outputUsage];
  }
  return { text, tool_calls: toolCalls, model: data.model || data.modelVersion, usage: { inputTokens: tokenCount(input), outputTokens: tokenCount(output) } };
}

/** Parse SSE incrementally, including CRLF, multiline data, UTF-8 split across packets,
 * usage-only final chunks and streamed tool argument fragments. No retries after output. */
async function readStream(response: Response, def: ProviderDefinition, params: AiChatParams): Promise<AiChatResult> {
  if (!response.body) throw new Error('Phản hồi trống');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let bytes = 0;
  const result: AiChatResult = { text: '', tool_calls: [], usage: { inputTokens: null, outputTokens: null } };
  const calls = new Map<number, ToolCall>();
  function accept(event: string) {
    const raw = event.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
    if (!raw || raw === '[DONE]') return;
    const data = JSON.parse(raw);
    if (data.error || data.type === 'error') throw new Error('Luồng phản hồi bị gián đoạn');
    let delta = '';
    if (def.adapter === 'anthropic') {
      delta = data.delta?.text || '';
      if (data.message?.model) result.model = data.message.model;
      if (data.message?.usage) result.usage.inputTokens = tokenCount(data.message.usage.input_tokens);
      if (data.usage) result.usage.outputTokens = tokenCount(data.usage.output_tokens);
      if (data.content_block?.type === 'tool_use') calls.set(data.index, { id: data.content_block.id, name: data.content_block.name, arguments: '' });
      if (data.delta?.partial_json && calls.has(data.index)) calls.get(data.index)!.arguments += data.delta.partial_json;
    } else if (def.adapter === 'cohere') {
      delta = data.delta?.message?.content?.text || '';
      const tool = data.delta?.message?.tool_calls;
      if (tool) {
        const current = calls.get(data.index || 0) || { id: tool.id || randomUUID(), name: '', arguments: '' };
        current.name += tool.function?.name || ''; current.arguments += tool.function?.arguments || ''; calls.set(data.index || 0, current);
      }
      const usage = data.delta?.usage?.billed_units;
      if (usage) result.usage = { inputTokens: tokenCount(usage.input_tokens), outputTokens: tokenCount(usage.output_tokens) };
    } else if (def.adapter === 'gemini') {
      const part = normalizeResponse(def, data);
      delta = part.text;
      result.tool_calls!.push(...(part.tool_calls || []));
      if (data.usageMetadata) result.usage = part.usage;
      if (part.model) result.model = part.model;
    } else {
      delta = data.choices?.[0]?.delta?.content || '';
      for (const tool of data.choices?.[0]?.delta?.tool_calls || []) {
        const current = calls.get(tool.index) || { id: tool.id || randomUUID(), name: '', arguments: '' };
        current.name += tool.function?.name || ''; current.arguments += tool.function?.arguments || ''; calls.set(tool.index, current);
      }
      if (data.usage) result.usage = normalizeResponse(def, data).usage;
      if (data.model) result.model = data.model;
    }
    result.text += delta;
    if (delta) params.onText?.(delta);
  }
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) { buffer += decoder.decode(); break; }
      bytes += value.byteLength;
      if (bytes > 4 * 1024 * 1024) throw new Error('Phản hồi vượt giới hạn cho phép');
      buffer += decoder.decode(value, { stream: true });
      // Keep a trailing CR until the next packet so split CRLF is handled correctly.
      buffer = buffer.replace(/\r\n/g, '\n');
      let end = buffer.indexOf('\n\n');
      while (end >= 0) { accept(buffer.slice(0, end)); buffer = buffer.slice(end + 2); end = buffer.indexOf('\n\n'); }
    }
    if (buffer.trim()) accept(buffer);
    result.tool_calls!.push(...calls.values());
    return result;
  } finally { await reader.cancel().catch(() => undefined); }
}

export async function executeAdapter(def: ProviderDefinition, baseUrl: string, apiKey: string, model: string,
  system: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, params: AiChatParams,
  signal: AbortSignal, custom = false): Promise<AiChatResult> {
  let path = '/chat/completions';
  const streaming = Boolean(params.onText);
  const tools = params.tools?.map((tool) => ({ type: 'function', function: tool }));
  let body: Record<string, unknown> = { model, messages: [{ role: 'system', content: system }, ...history],
    temperature: params.temperature, top_p: params.topP, [def.flags.maxTokens]: params.maxTokens,
    ...(tools?.length ? { tools, ...(def.flags.toolChoice ? { tool_choice: 'auto' } : {}) } : {}),
    ...(streaming ? { stream: true, ...(def.flags.streamUsage ? { stream_options: { include_usage: true } } : {}) } : {}) };
  if (def.adapter === 'anthropic') {
    path = '/messages'; body = { model, system, messages: history, max_tokens: params.maxTokens, temperature: params.temperature,
      ...(streaming ? { stream: true } : {}), ...(params.tools?.length ? { tools: params.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) } : {}) };
  } else if (def.adapter === 'gemini') {
    path = `/models/${encodeURIComponent(model.replace(/^models\//, ''))}:${streaming ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
    body = { systemInstruction: { parts: [{ text: system }] }, contents: history.map((h) => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
      generationConfig: { temperature: params.temperature, topP: params.topP, maxOutputTokens: params.maxTokens },
      ...(params.tools?.length ? { tools: [{ functionDeclarations: params.tools }] } : {}) };
  } else if (def.adapter === 'cohere') {
    path = '/v2/chat'; delete body.top_p; body.p = params.topP;
  }
  const init = { method: 'POST', headers: authHeaders(def, apiKey), body: JSON.stringify(body), signal, redirect: 'error' as const };
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const response = await (custom ? customFetch(url, init) : fetch(url, init));
  if (!response.ok) { await response.body?.cancel(); throw new ProviderHttpError(response.status); }
  return streaming ? readStream(response, def, params) : normalizeResponse(def, await readJson(response));
}
