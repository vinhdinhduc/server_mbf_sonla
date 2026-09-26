import { createAiProvider } from '../../src/services/aiProvider.service';

describe('AI provider transport', () => {
  const params = { temperature: 0, maxTokens: 200, topP: 1 };
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
    expect(await provider.chat('system', 'context', [], 'question', params)).toBe('OK');
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
});
