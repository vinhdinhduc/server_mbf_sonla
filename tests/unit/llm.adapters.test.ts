import { executeAdapter } from '../../src/services/llm/adapters';
import { getProvider } from '../../src/services/llm/registry/providers';

describe('Native and compatible HTTP contracts', () => {
  afterEach(() => jest.restoreAllMocks());
  const params = { temperature: .2, maxTokens: 1024, topP: 1, tools: [{ name: 'lookup', description: 'Tra cứu', parameters: { type: 'object', properties: {} } }] };
  const samples = [
    { id: 'openai', path: '/chat/completions', body: { model: 'test', choices: [{ message: { content: 'OK', tool_calls: [{ id: 't', function: { name: 'lookup', arguments: '{}' } }] } }], usage: { prompt_tokens: 12, completion_tokens: 4 } } },
    { id: 'anthropic', path: '/messages', body: { model: 'test', content: [{ type: 'text', text: 'OK' }, { type: 'tool_use', id: 't', name: 'lookup', input: {} }], usage: { input_tokens: 12, output_tokens: 4 } } },
    { id: 'gemini', path: '/models/test:generateContent', body: { modelVersion: 'test', candidates: [{ content: { parts: [{ text: 'hidden', thought: true }, { text: 'OK' }, { functionCall: { id: 't', name: 'lookup', args: {} } }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3, thoughtsTokenCount: 1 } } },
    { id: 'cohere', path: '/v2/chat', body: { message: { content: [{ text: 'OK' }], tool_calls: [{ id: 't', function: { name: 'lookup', arguments: '{}' } }] }, usage: { billed_units: { input_tokens: 12, output_tokens: 4 }, tokens: { input_tokens: 999, output_tokens: 8 } } } },
    { id: 'ai21', path: '/chat/completions', body: { choices: [{ message: { content: 'OK', tool_calls: [{ id: 't', function: { name: 'lookup', arguments: '{}' } }] } }], usage: { prompt_tokens: 12, completion_tokens: 4 } } },
  ];
  test.each(samples)('$id request/auth/tools and normalized response', async ({ id, path, body }) => {
    const mocked = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(body)));
    const result = await executeAdapter(getProvider(id), 'https://provider.example', 'secret', 'test', 'system', [{ role: 'user', content: 'hi' }], params, AbortSignal.timeout(1000));
    expect(result).toMatchObject({ text: 'OK', usage: { inputTokens: 12, outputTokens: 4 }, tool_calls: [{ id: 't', name: 'lookup', arguments: '{}' }] });
    const [url, init] = mocked.mock.calls[0];
    expect(url).toBe(`https://provider.example${path}`);
    expect(init?.redirect).toBe('error');
    const payload = JSON.parse(String(init?.body));
    expect(payload.tools.length).toBe(1);
    expect(init?.headers).toMatchObject(id === 'anthropic' ? { 'x-api-key': 'secret', 'anthropic-version': '2023-06-01' } : id === 'gemini' ? { 'x-goog-api-key': 'secret' } : { Authorization: 'Bearer secret' });
    if (id === 'openai') { expect(payload.max_completion_tokens).toBe(1024); expect(payload.max_tokens).toBeUndefined(); }
    if (id === 'cohere') { expect(payload.p).toBe(1); expect(payload.top_p).toBeUndefined(); }
  });
  test.each(samples)('$id maps HTTP errors without leaking response or key', async ({ id }) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('private-key', { status: 401 }));
    await expect(executeAdapter(getProvider(id), 'https://provider.example', 'secret', 'test', '', [], params, AbortSignal.timeout(1000))).rejects.toMatchObject({ status: 401, message: 'Không thể kết nối nhà cung cấp AI' });
  });
  test.each([
    ['openai', [{ choices: [{ delta: { content: 'Xin ' } }] }, { choices: [{ delta: { content: 'chào', tool_calls: [{ index: 0, id: 't', function: { name: 'lookup', arguments: '{' } }] } }] }, { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '}' } }] } }], usage: { prompt_tokens: 12, completion_tokens: 4 } }]],
    ['ai21', [{ choices: [{ delta: { content: 'Xin chào' } }], usage: { prompt_tokens: 12, completion_tokens: 4 } }]],
    ['anthropic', [{ type: 'message_start', message: { usage: { input_tokens: 12 } } }, { type: 'content_block_delta', delta: { text: 'Xin chào' } }, { type: 'message_delta', usage: { output_tokens: 4 } }]],
    ['gemini', [{ candidates: [{ content: { parts: [{ text: 'Xin chào' }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 4 } }]],
    ['cohere', [{ type: 'content-delta', delta: { message: { content: { text: 'Xin chào' } } } }, { type: 'message-end', delta: { usage: { billed_units: { input_tokens: 12, output_tokens: 4 } } } }]],
  ] as const)('%s SSE handles byte boundaries and final usage', async (id, events) => {
    const bytes = new TextEncoder().encode(events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join('') + 'data: [DONE]\r\n\r\n');
    const stream = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(stream));
    const onText = jest.fn();
    const result = await executeAdapter(getProvider(id), 'https://provider.example', 'secret', 'test', '', [], { ...params, onText }, AbortSignal.timeout(1000));
    expect(result.text).toBe('Xin chào'); expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 4 });
    expect(onText.mock.calls.flat().join('')).toBe('Xin chào');
    if (id === 'openai') expect(result.tool_calls).toEqual([{ id: 't', name: 'lookup', arguments: '{}' }]);
  });
});
