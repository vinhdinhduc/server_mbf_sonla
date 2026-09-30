import { Op } from 'sequelize';
import {
  chatbotService,
  buildContext,
  buildChatContext,
  retrievalQuestion,
} from '../../src/services/chatbot.service';
import { AiChatLog } from '../../src/models/AiChatLog.model';
import { AiKnowledgeEntry } from '../../src/models/AiKnowledgeEntry.model';
import { Package } from '../../src/models/Package.model';
import { SimNumber } from '../../src/models/SimNumber.model';
import { News } from '../../src/models/News.model';
import { Solution } from '../../src/models/Solution.model';
import { Store } from '../../src/models/Store.model';
import { aiSettingsService } from '../../src/services/aiSettings.service';
import { settingService } from '../../src/services/setting.service';

jest.mock('../../src/services/aiSettings.service', () => ({
  ...jest.requireActual('../../src/services/aiSettings.service'),
  aiSettingsService: { getPublicConfig: jest.fn(), resolveProvider: jest.fn() },
}));
jest.mock('../../src/services/setting.service', () => ({
  settingService: { getRawValue: jest.fn() },
}));

describe('Chatbot grounding and conversation', () => {
  const chat = jest.fn();
  beforeEach(() => {
    for (const model of [AiKnowledgeEntry, Package, SimNumber, News, Solution, Store]) {
      jest.spyOn(model, 'findAll').mockResolvedValue([]);
    }
    jest.spyOn(AiChatLog, 'count').mockResolvedValue(0);
    jest.spyOn(AiChatLog, 'findAll').mockResolvedValue([]);
    jest.spyOn(AiChatLog, 'create').mockResolvedValue({} as never);
    jest.mocked(aiSettingsService.getPublicConfig).mockResolvedValue({
      enabled: true,
      rag_enabled: true,
      daily_limit: 20,
      provider: 'anthropic',
      model: 'test',
    });
    jest.mocked(aiSettingsService.resolveProvider).mockResolvedValue({
      provider: { chat, testConnection: jest.fn() },
      prompt: 'Grounded reply',
      params: { temperature: 0, maxTokens: 500, topP: 1 },
      config: { ai_provider: 'anthropic', ai_model: 'test' },
    });
    jest.mocked(settingService.getRawValue).mockResolvedValue(null);
    chat
      .mockReset()
      .mockResolvedValue({
        text: 'Câu trả lời từ dữ liệu nội bộ',
        usage: { inputTokens: 123, outputTokens: 45 },
      });
  });
  afterEach(() => jest.restoreAllMocks());

  test('general package question retrieves active, current packages ordered by price', async () => {
    jest.mocked(Package.findAll).mockResolvedValue([
      {
        name: 'Gói A',
        code: 'A',
        price: 90000,
        duration_value: 30,
        duration_unit: 'day',
        slug: 'goi-a',
      },
    ] as never);
    const context = await buildContext('Gói cước nào rẻ?');
    expect(context).toContain('90000 VNĐ');
    expect(context).toContain('/goi-cuoc/goi-a');
    const options = jest.mocked(Package.findAll).mock.calls[0][0]!;
    expect(options.order).toEqual([['price', 'ASC']]);
    expect(options.where).toMatchObject({ status: 'active', deleted_at: null });
    expect(Reflect.get(options.where!, Op.and)).toHaveLength(2);
  });

  test('store suggestions exclude inactive stores and context remains bounded', async () => {
    jest
      .mocked(AiKnowledgeEntry.findAll)
      .mockResolvedValue([{ title: 'Hỗ trợ', content: 'x'.repeat(50000) }] as never);
    const context = await buildContext('Cửa hàng gần tôi');
    expect(jest.mocked(Store.findAll).mock.calls[0][0]?.where).toEqual({ status: 'active' });
    expect(context.length).toBeLessThanOrEqual(24000);
  });

  test('preserves chronological history and scopes it to this visitor', async () => {
    jest.mocked(AiChatLog.findAll).mockResolvedValue([
      { user_message: 'Câu 2', ai_response: 'Đáp 2' },
      { user_message: 'Câu 1', ai_response: 'Đáp 1' },
    ] as never);
    const result = await chatbotService.answerQuestion('session-a', 'Tư vấn gói cước', '127.0.0.1');
    expect(result.reply).toBe('Câu trả lời từ dữ liệu nội bộ');
    expect(AiChatLog.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { session_id: 'session-a', ip_address: '127.0.0.1', flagged_for_review: false },
      }),
    );
    expect(chat.mock.calls[0][2][0]).toEqual({ role: 'user', content: 'Câu 1' });
    expect(AiChatLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'anthropic',
        model: 'test',
        input_tokens: 123,
        output_tokens: 45,
      }),
    );
  });

  test('daily quota stops provider calls', async () => {
    jest.mocked(AiChatLog.count).mockResolvedValue(20);
    const result = await chatbotService.answerQuestion('session-a', 'Tư vấn', '127.0.0.1');
    expect(result.reply).toContain('20 lượt');
    expect(chat).not.toHaveBeenCalled();
  });

  test('provider failure returns configured fallback without leaking the error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    chat.mockRejectedValue(new Error('provider failure'));
    jest.mocked(settingService.getRawValue).mockResolvedValue('Vui lòng liên hệ hỗ trợ');
    expect(await chatbotService.answerQuestion('session-a', 'Tư vấn', '127.0.0.1')).toEqual({
      reply: 'Vui lòng liên hệ hỗ trợ',
      status: 'unavailable',
      sources: [],
    });
  });

  test('disabled chatbot does not contact provider', async () => {
    jest.mocked(aiSettingsService.getPublicConfig).mockResolvedValue({ enabled: false } as never);
    await expect(chatbotService.answerQuestion('session-a', 'Tư vấn', '127.0.0.1')).rejects.toThrow(
      'tạm ngưng',
    );
    expect(chat).not.toHaveBeenCalled();
  });

  test('an explicit package code is not replaced by the cheapest generic packages', async () => {
    await buildChatContext('Tư vấn gói cước C90N');
    const where = jest.mocked(Package.findAll).mock.calls[0][0]!.where!;
    expect(Reflect.get(Reflect.get(where, 'code'), Op.in)).toEqual(['c90n']);
  });

  test('budget amounts are not mistaken for package codes', async () => {
    await buildChatContext('Gói cước dưới 120k');
    expect(jest.mocked(Package.findAll).mock.calls[0][0]?.where).not.toHaveProperty('code');
  });

  test('follow-up retrieval retains the topic and explicit topic switches reset it', () => {
    expect(retrievalQuestion('Đăng ký thế nào?', ['Gói cước C90N'])).toContain('C90N');
    expect(retrievalQuestion('Cửa hàng ở đâu?', ['Gói cước C90N'])).toBe('Cửa hàng ở đâu?');
  });

  test('reference links are constructed from catalog records', async () => {
    jest
      .mocked(SimNumber.findAll)
      .mockResolvedValue([
        { id: 7, phone_number: '0901234567', price: 100000, sim_type: 'prepaid' },
      ] as never);
    const result = await buildChatContext('SIM số đẹp');
    expect(result.sources).toContainEqual({ title: 'SIM 0901234567', href: '/sim-so-dep/7' });
  });
});
