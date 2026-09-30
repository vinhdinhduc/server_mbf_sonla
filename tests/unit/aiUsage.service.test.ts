import { aiUsageService, estimateCost, tokenCount } from '../../src/services/aiUsage.service';
import { sequelize } from '../../src/config/database';
import {
  aiSettingsSchema,
  aiTestConnectionSchema,
  aiPricesSchema,
} from '../../src/validators/ai.validator';

describe('AI usage accounting', () => {
  afterEach(() => jest.restoreAllMocks());
  test('uses configured prices and keeps missing usage/prices unknown', () => {
    const usage = { inputTokens: 1000, outputTokens: 200 };
    const price = {
      provider: 'openai',
      model: 'test',
      input_per_million: 2,
      output_per_million: 8,
    };
    expect(estimateCost(usage, price)).toBe(0.0036);
    expect(estimateCost(usage)).toBeNull();
    expect(estimateCost({ ...usage, inputTokens: null }, price)).toBeNull();
    expect(estimateCost({ inputTokens: 0, outputTokens: 0 }, price)).toBe(0);
    for (const value of [undefined, -1, NaN, 1.5, '12', Infinity])
      expect(tokenCount(value)).toBeNull();
  });
  test('records only metadata, with a snapshot of prices', async () => {
    const query = jest.spyOn(sequelize, 'query').mockResolvedValue([] as never);
    await aiUsageService.record({
      requestId: 'test',
      attempt: 1,
      purpose: 'chat',
      provider: 'openai',
      model: 'test',
      inputTokens: 1000,
      outputTokens: 200,
      errorCode: null,
      latencyMs: 4,
      price: { provider: 'openai', model: 'test', input_per_million: 2, output_per_million: 8 },
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_provider_calls'),
      expect.objectContaining({
        logging: false,
        replacements: expect.objectContaining({ cost: 0.0036, inputPrice: 2, outputPrice: 8 }),
      }),
    );
  });
  test('cleanup deletes in bounded batches with the 12 month retention cutoff', async () => {
    const query = jest
      .spyOn(sequelize, 'query')
      .mockResolvedValueOnce([[], { affectedRows: 1000 }] as never)
      .mockResolvedValueOnce([[], { affectedRows: 4 }] as never);
    await aiUsageService.cleanup();
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INTERVAL 12 MONTH) LIMIT 1000'), {
      logging: false,
    });
  });
  test('validates key, model and prices locally', () => {
    expect(
      aiTestConnectionSchema.safeParse({ provider: 'openai', model: '  ', api_key: 'key' }).success,
    ).toBe(false);
    expect(
      aiTestConnectionSchema.safeParse({
        provider: 'openai',
        model: 'test',
        api_key: 'key\nsecret',
      }).success,
    ).toBe(false);
    const price = {
      provider: 'openai',
      model: 'test',
      input_per_million: 1,
      output_per_million: 2,
    };
    expect(aiPricesSchema.safeParse([price, price]).success).toBe(false);
    expect(aiPricesSchema.safeParse([{ ...price, input_per_million: -1 }]).success).toBe(false);
    expect(aiSettingsSchema.shape.enabled.safeParse('false').success).toBe(false);
  });
});
