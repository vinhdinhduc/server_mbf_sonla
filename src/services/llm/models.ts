import { createHash } from 'crypto';
import { authHeaders, ProviderHttpError, ProviderOptions } from './adapters';
import { getProvider, model, ModelDefinition, resolveEndpoint } from './registry/providers';
import { customFetch, readJson } from './safeHttp';

const cache = new Map<string, { expires: number; models: ModelDefinition[] }>();
export function clearModelCache() { cache.clear(); }
export function isChatModel(item: any): boolean {
  const id = String(item.id || item.name || '');
  if (!id || id.length > 150 || !/^[\w~][\w./:~-]*$/.test(id)) return false;
  if (/(embed|rerank|moderation|whisper|tts|transcrib|dall-e|imagen|image-generation|flux|stable-diffusion|video|audio|guard|ocr)/i.test(id)) return false;
  if (item.capabilities?.completion_chat === false) return false;
  if (item.type && ['embedding', 'image', 'audio', 'rerank'].includes(item.type)) return false;
  if (item.supportedGenerationMethods && !item.supportedGenerationMethods.includes('generateContent')) return false;
  if (item.endpoints && !item.endpoints.includes('chat')) return false;
  if (item.architecture?.output_modalities && !item.architecture.output_modalities.includes('text')) return false;
  return true;
}
export async function listProviderModels(id: string, key: string, options: ProviderOptions) {
  const original = getProvider(id);
  const { definition, baseUrl } = resolveEndpoint(id, options.endpoint_id, options.base_url);
  const fallback = (id === 'llama' ? [] : definition.models).filter((m) => !m.endpointId || m.endpointId === options.endpoint_id);
  if (!definition.modelListPath) return { models: fallback, source: 'static', message: 'Nhà cung cấp chưa có API danh sách model được xác minh. Bạn có thể nhập model khác.' };
  const hash = createHash('sha256').update(JSON.stringify([id, baseUrl, options.host, key])).digest('hex');
  const cached = cache.get(hash);
  if (cached && cached.expires > Date.now()) return { models: cached.models, source: 'cache' };
  const merged = new Map(fallback.map((item) => [item.id, item]));
  const signal = AbortSignal.timeout(20000);
  let cursor = '';
  // A bounded loop handles Gemini/Anthropic/Cohere pagination without accepting next-page URLs.
  for (let page = 0; page < 10; page += 1) {
    const query = new URLSearchParams();
    if (definition.adapter === 'anthropic') { query.set('limit', '100'); if (cursor) query.set('after_id', cursor); }
    if (definition.adapter === 'gemini') { query.set('pageSize', '1000'); if (cursor) query.set('pageToken', cursor); }
    if (definition.adapter === 'cohere') { query.set('page_size', '1000'); query.set('endpoint', 'chat'); if (cursor) query.set('page_token', cursor); }
    const url = `${baseUrl}${definition.modelListPath}${query.size ? `?${query}` : ''}`;
    const init = { headers: authHeaders(definition, key), signal, redirect: 'error' as const };
    const response = await (id === 'custom' ? customFetch(url, init) : fetch(url, init));
    if (!response.ok) { await response.body?.cancel(); throw new ProviderHttpError(response.status); }
    const data = await readJson(response);
    const items = Array.isArray(data) ? data : data.data || data.models;
    if (!Array.isArray(items)) throw new Error('Danh sách model không hợp lệ');
    for (const item of items.slice(0, 5000)) {
      if (!isChatModel(item)) continue;
      const modelId = String(item.id || item.name).replace(/^models\//, '');
      if (id === 'llama' && !/llama/i.test(modelId)) continue;
      const previous = merged.get(modelId);
      merged.set(modelId, model(modelId, { ...previous, label: item.displayName || item.display_name || item.name || modelId,
        contextWindow: item.context_length || item.max_context_length || item.inputTokenLimit || previous?.contextWindow || null,
        maxOutputTokens: item.outputTokenLimit || item.top_provider?.max_completion_tokens || previous?.maxOutputTokens || null,
        tools: item.capabilities?.function_calling ?? (Array.isArray(item.supported_parameters) ? item.supported_parameters.includes('tools') : previous?.tools ?? null),
        source: 'api',
        // Availability from API is not verification of pricing or all model capabilities.
        verified: previous?.verified || false,
      }));
    }
    const next = data.nextPageToken || data.next_page_token || (data.has_more ? data.last_id : '');
    if (!next || next === cursor || typeof next !== 'string') break;
    cursor = next;
  }
  const models = [...merged.values()].sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.label.localeCompare(b.label));
  for (const [k, value] of cache) if (value.expires < Date.now()) cache.delete(k);
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(hash, { models, expires: Date.now() + 120000 });
  return { models, source: 'api', provider: original.id };
}
