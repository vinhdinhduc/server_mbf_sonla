import { aiSettingsService } from '../../src/services/aiSettings.service';
import { Setting } from '../../src/models/Setting.model';
import { createAiProvider } from '../../src/services/aiProvider.service';

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
  ])('maps provider status %s to an actionable message', async (status, message) => {
    testConnection.mockRejectedValue({ status });
    await expect(
      aiSettingsService.testConnection({ provider: 'gemini', model: 'test', api_key: 'test-key' }),
    ).rejects.toThrow(String(message));
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
});
