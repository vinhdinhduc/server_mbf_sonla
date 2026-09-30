import { z } from 'zod';

export const aiProviderEnum = z.enum(['openai', 'anthropic', 'gemini']);
const modelSchema = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/, 'Tên model không hợp lệ');
const apiKeySchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      !value ||
      (/^[\x21-\x7e]+$/.test(value) && !value.startsWith('****') && !value.startsWith('enc:')),
    'API key không đúng định dạng',
  )
  .optional();
export const aiPricesSchema = z
  .array(
    z.object({
      provider: aiProviderEnum,
      model: modelSchema,
      input_per_million: z.number().finite().min(0).max(100000),
      output_per_million: z.number().finite().min(0).max(100000),
    }),
  )
  .max(200)
  .refine(
    (items) => new Set(items.map((item) => `${item.provider}:${item.model}`)).size === items.length,
    'Không được trùng nhà cung cấp và model trong bảng giá',
  );
export const aiSettingsSchema = z.object({
  provider: aiProviderEnum,
  model: modelSchema,
  api_key: apiKeySchema,
  prices: aiPricesSchema.optional(),
  temperature: z.coerce.number().min(0).max(1),
  max_tokens: z.coerce.number().int().min(20).max(4000),
  top_p: z.coerce.number().min(0).max(1),
  system_prompt: z.string().min(1).max(10000),
  daily_limit: z.coerce.number().int().min(1).max(10000),
  rag_enabled: z.boolean(),
  enabled: z.boolean(),
});

export const aiTestConnectionSchema = z.object({
  provider: aiProviderEnum,
  model: modelSchema,
  api_key: apiKeySchema,
});

export const knowledgeSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  tags: z.string().max(255).optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const chatLogUpdateSchema = z.object({
  flagged_for_review: z.boolean().optional(),
  was_helpful: z.boolean().nullable().optional(),
});
