import { clearModelCache, isChatModel, listProviderModels } from '../../src/services/llm/models';

describe('Live model discovery', () => {
  beforeEach(clearModelCache);
  afterEach(() => jest.restoreAllMocks());
  test.each(['text-embedding-3-small', 'whisper-large', 'flux-1', 'rerank-v3', 'tts-1', 'llama-guard', 'gemini-audio'])('excludes %s', (id) => expect(isChatModel({ id })).toBe(false));
  test('merges static models and caches by key and endpoint without storing raw keys', async () => {
    const mock = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [{ id: 'gpt-4.1-mini' }, { id: 'brand-new-chat' }, { id: 'text-embedding-3-small' }] })));
    const first = await listProviderModels('openai', 'key-a', {});
    expect(first.models.find((m) => m.id === 'gpt-4.1-mini')).toMatchObject({ source: 'api', priceInPer1M: .4 });
    expect(first.models.some((m) => m.id === 'brand-new-chat')).toBe(true);
    expect(first.models.some((m) => /embed/.test(m.id))).toBe(false);
    await listProviderModels('openai', 'key-a', {}); expect(mock).toHaveBeenCalledTimes(1);
    await listProviderModels('openai', 'key-b', {}); expect(mock).toHaveBeenCalledTimes(2);
  });
  test('paginates native Gemini and filters non-generation models', async () => {
    const mock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ models: [{ name: 'models/chat-a', supportedGenerationMethods: ['generateContent'] }], nextPageToken: 'second' }))).mockResolvedValueOnce(new Response(JSON.stringify({ models: [{ name: 'models/chat-b', supportedGenerationMethods: ['generateContent'] }, { name: 'models/other', supportedGenerationMethods: ['embedContent'] }] })));
    const result = await listProviderModels('gemini', 'key', {});
    expect(result.models.map((m) => m.id)).toEqual(expect.arrayContaining(['chat-a', 'chat-b']));
    expect(result.models.some((m) => m.id === 'other')).toBe(false);
    expect(String(mock.mock.calls[1][0])).toContain('pageToken=second');
  });
  test('Llama host discovery only includes Llama models', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'llama-chat' }, { id: 'qwen-chat' }] })));
    const result = await listProviderModels('llama', 'key', { endpoint_id: 'groq' });
    expect(result.models.map((m) => m.id)).toEqual(['llama-chat']);
  });
});
