import { createAiProvider } from '../../src/services/aiProvider.service';
import { aiUsageService } from '../../src/services/aiUsage.service';
import Anthropic from '@anthropic-ai/sdk';

jest.mock('@anthropic-ai/sdk');

describe('AI provider transport', () => {
  const params = { temperature: 0, maxTokens: 200, topP: 1 };
  beforeEach(() => jest.spyOn(aiUsageService, 'record').mockResolvedValue());
  afterEach(() => jest.restoreAllMocks());

  test('retries temporary provider errors and returns the successful reply', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), {
          status: 200,
        }),
      );
    const provider = createAiProvider('gemini', 'test-model', 'test-only-key');
    expect(await provider.chat('system', 'context', [], 'question', params)).toMatchObject({
      text: 'OK',
      usage: { inputTokens: null, outputTokens: null },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(aiUsageService.record).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ attempt: 1, errorCode: 'provider_unavailable' }),
    );
    expect(aiUsageService.record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ attempt: 2, errorCode: null }),
    );
  });

  test('does not retry rejected credentials', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('', { status: 401 }));
    await expect(
      createAiProvider('gemini', 'test-model', 'test-only-key').testConnection(params),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('connection check fails when provider returns no text', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    await expect(
      createAiProvider('gemini', 'test-model', 'test-only-key').testConnection(params),
    ).rejects.toThrow('empty reply');
  });
  test.each(['openai', 'gemini'] as const)(
    '%s persists real usage and never records messages or credentials',
    async (provider) => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'private reply' } }],
            usage: { prompt_tokens: 123, completion_tokens: 45 },
          }),
        ),
      );
      const result = await createAiProvider(provider, 'test-model', 'private-key').chat(
        'private system',
        'private context',
        [],
        'private question',
        params,
      );
      expect(result.usage).toEqual({ inputTokens: 123, outputTokens: 45 });
      expect(aiUsageService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          provider,
          model: 'test-model',
          inputTokens: 123,
          outputTokens: 45,
          purpose: 'chat',
        }),
      );
      expect(JSON.stringify(jest.mocked(aiUsageService.record).mock.calls)).not.toContain(
        'private',
      );
    },
  );

  test('Anthropic joins text blocks and preserves native usage', async () => {
    const create = jest.fn().mockResolvedValue({
      content: [
        { type: 'text', text: 'A' },
        { type: 'text', text: 'B' },
      ],
      usage: { input_tokens: 99, output_tokens: 10 },
    });
    jest.mocked(Anthropic).mockImplementation(() => ({ messages: { create } }) as never);
    expect(
      await createAiProvider('anthropic', 'test', 'key').chat('s', 'c', [], 'q', params),
    ).toEqual({ text: 'A\nB', usage: { inputTokens: 99, outputTokens: 10 } });
  });

  test('an empty paid response still records usage without retrying', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 8 } }),
        ),
      );
    await expect(createAiProvider('openai', 'test', 'key').testConnection(params)).rejects.toThrow(
      'empty reply',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(aiUsageService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        inputTokens: 12,
        outputTokens: 8,
        errorCode: 'empty_response',
        purpose: 'connection_test',
      }),
    );
  });

  test('a failed usage write never retries a successful paid call', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(aiUsageService.record).mockRejectedValue(new Error('sensitive database error'));
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] })),
      );
    await expect(
      createAiProvider('openai', 'test', 'key').testConnection(params),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('AI usage write failed');
  });

  test('retries share one deadline and an expired request is not sent again', async () => {
    const controller = new AbortController();
    jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => {
      controller.abort(new DOMException('expired', 'TimeoutError'));
      throw controller.signal.reason;
    });
    await expect(
      createAiProvider('openai', 'test', 'key').testConnection(params),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(AbortSignal.timeout).toHaveBeenCalledWith(20000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(aiUsageService.record).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'timeout' }),
    );
  });
});
