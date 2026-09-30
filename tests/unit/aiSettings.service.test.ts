import { aiSettingsService } from '../../src/services/aiSettings.service';
import { Setting } from '../../src/models/Setting.model';
import { createAiProvider } from '../../src/services/aiProvider.service';
import { decryptSecret, encryptSecret } from '../../src/utils/secretCrypto';
import { env } from '../../src/config/env';
import { sequelize } from '../../src/config/database';

jest.mock('../../src/services/aiProvider.service', () => ({
  ...jest.requireActual('../../src/services/aiProvider.service'),
  createAiProvider: jest.fn(),
}));

describe('AI settings diagnostics', () => {
  const testConnection = jest.fn();
  beforeEach(() => {
    jest.spyOn(Setting, 'findAll').mockResolvedValue([]);
    testConnection.mockReset();
    jest.mocked(createAiProvider).mockReturnValue({ testConnection, chat: jest.fn() });
  });
  afterEach(() => jest.restoreAllMocks());

  test.each([
    [401, 'API key không hợp lệ'],
    [403, 'chưa có quyền'],
    [404, 'Không tìm thấy model'],
    [429, 'chạm giới hạn'],
    [400, 'tham số'],
    [408, '20 giây'],
  ])('maps provider status %s to an actionable message', async (status, message) => {
    testConnection.mockRejectedValue({ status });
    await expect(
      aiSettingsService.testConnection({ provider: 'gemini', model: 'test', api_key: 'test-key' }),
    ).rejects.toThrow(String(message));
  });

  test('reports transport timeouts without exposing provider details', async () => {
    testConnection.mockRejectedValue(new DOMException('sensitive details', 'TimeoutError'));
    await expect(
      aiSettingsService.testConnection({ provider: 'openai', model: 'test', api_key: 'draft-key' }),
    ).rejects.toThrow('20 giây');
  });

  test('does not reuse another provider stored key during connection testing', async () => {
    jest.mocked(Setting.findAll).mockResolvedValue([
      { key: 'ai_provider', value: 'anthropic' },
      { key: 'ai_api_key_encrypted', value: 'not-a-real-encrypted-key' },
    ] as never);
    await expect(
      aiSettingsService.testConnection({ provider: 'gemini', model: 'test' }),
    ).rejects.toThrow('Chưa cấu hình API key');
    expect(testConnection).not.toHaveBeenCalled();
  });

  function storedKey(value: string) {
    jest.mocked(Setting.findAll).mockResolvedValue([
      { key: 'ai_provider', value: 'gemini' },
      { key: 'ai_api_key_encrypted', value },
    ] as never);
  }

  function keyFromAnotherInstallation() {
    const original = env.APP_SECRET_KEY;
    try {
      env.APP_SECRET_KEY = 'different-test-installation-secret-key';
      return encryptSecret('old-api-key');
    } finally {
      env.APP_SECRET_KEY = original;
    }
  }

  test('keeps admin settings readable after the encryption key changes', async () => {
    const encrypted = keyFromAnotherInstallation();
    storedKey(encrypted);
    const upsert = jest.spyOn(Setting, 'upsert');
    const config = await aiSettingsService.getAdminConfig();
    expect(config).toMatchObject({
      has_api_key: false,
      api_key_masked: null,
      api_key_error: expect.stringContaining('APP_SECRET_KEY'),
    });
    expect(JSON.stringify(config)).not.toContain(encrypted);
    expect(JSON.stringify(config)).not.toContain('old-api-key');
    expect(upsert).not.toHaveBeenCalled();
    expect(() => decryptSecret(encrypted)).toThrow();
  });

  test('reports malformed ciphertext without breaking the settings page', async () => {
    storedKey('enc:v1:invalid');
    await expect(aiSettingsService.getAdminConfig()).resolves.toMatchObject({
      has_api_key: false,
      api_key_error: expect.stringContaining('nhập lại API key'),
    });
  });

  test('masks a valid stored key', async () => {
    storedKey(encryptSecret('test-secret-1234'));
    await expect(aiSettingsService.getAdminConfig()).resolves.toMatchObject({
      has_api_key: true,
      api_key_masked: '****1234',
      api_key_error: null,
    });
  });

  test('rejects unusable stored credentials before contacting the provider', async () => {
    storedKey(keyFromAnotherInstallation());
    await expect(
      aiSettingsService.testConnection({ provider: 'gemini', model: 'test' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('nhập lại API key'),
    });
    await expect(aiSettingsService.resolveProvider()).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('APP_SECRET_KEY'),
    });
    expect(createAiProvider).not.toHaveBeenCalled();
  });

  test('allows testing a replacement key when the saved key cannot be decrypted', async () => {
    storedKey(keyFromAnotherInstallation());
    testConnection.mockResolvedValue(undefined);
    await expect(
      aiSettingsService.testConnection({
        provider: 'gemini',
        model: 'test',
        api_key: 'replacement',
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(createAiProvider).toHaveBeenCalledWith('gemini', 'test', 'replacement', undefined);
  });

  test('recovers by saving a new key encrypted with the current application secret', async () => {
    const config: Record<string, string> = {
      ai_provider: 'gemini',
      ai_api_key_encrypted: keyFromAnotherInstallation(),
    };
    jest
      .mocked(Setting.findAll)
      .mockImplementation(
        async () => Object.entries(config).map(([key, value]) => ({ key, value })) as never,
      );
    jest.spyOn(Setting, 'upsert').mockImplementation(async (item: any) => {
      config[item.key] = item.value;
      return [item, true] as never;
    });
    const originalSequelize = Object.getOwnPropertyDescriptor(Setting, 'sequelize');
    Object.defineProperty(Setting, 'sequelize', { value: sequelize, configurable: true });
    try {
      jest.spyOn(sequelize, 'query').mockResolvedValue([{ version: 1 }] as never);
      const result = await aiSettingsService.update(
        {
          provider: 'gemini',
          model: 'test',
          api_key: 'replacement-5678',
          temperature: 0.4,
          max_tokens: 500,
          top_p: 1,
          system_prompt: 'test',
          daily_limit: 20,
          rag_enabled: true,
          enabled: true,
        },
        1,
      );
      expect(result).toMatchObject({
        has_api_key: true,
        api_key_masked: '****5678',
        api_key_error: null,
      });
      expect(config.ai_api_key_encrypted).not.toContain('replacement-5678');
      expect(decryptSecret(config.ai_api_key_encrypted)).toBe('replacement-5678');
      expect(testConnection).not.toHaveBeenCalled();
    } finally {
      if (originalSequelize) Object.defineProperty(Setting, 'sequelize', originalSequelize);
      else Reflect.deleteProperty(Setting, 'sequelize');
    }
  });
});
