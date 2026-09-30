import { z } from 'zod';
import { providers, resolveEndpoint } from '../services/llm/registry/providers';
import { validateBaseUrl } from '../services/llm/safeHttp';

export const aiProviderEnum = z.string().refine((id) => providers.some((p) => p.id === id), 'Nhà cung cấp không hợp lệ');
const modelSchema = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .regex(/^[a-zA-Z0-9~][a-zA-Z0-9._:/~-]*$/, 'Tên model không hợp lệ');
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
export const aiProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  provider: aiProviderEnum,
  model: modelSchema,
  api_key: apiKeySchema,
  endpoint_id: z.string().max(50).optional(),
  base_url: z.string().max(1000).optional(),
  host: z.string().regex(/^[a-zA-Z0-9-]*$/).max(60).optional(),
  enabled: z.boolean(),
  temperature: z.number().min(0).max(1),
  max_tokens: z.number().int().min(20).max(4000),
  top_p: z.number().min(0).max(1),
}).superRefine((item, ctx) => {
  try {
    const endpoint = resolveEndpoint(item.provider, item.endpoint_id, item.base_url);
    if (item.provider === 'custom') validateBaseUrl(endpoint.baseUrl);
  } catch { ctx.addIssue({ code: 'custom', path: ['endpoint_id'], message: 'Endpoint không hợp lệ hoặc chưa khả dụng' }); }
});
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
  profiles: z.array(aiProfileSchema).min(1).max(12).refine((items) => new Set(items.map((p) => p.id)).size === items.length, 'Profile bị trùng').optional(),
});

export const aiTestConnectionSchema = z.object({
  provider: aiProviderEnum,
  model: modelSchema,
  api_key: apiKeySchema,
  profile_id: z.string().uuid().optional(),
  endpoint_id: z.string().max(50).optional(),
  base_url: z.string().max(1000).optional(),
  host: z.string().regex(/^[a-zA-Z0-9-]*$/).max(60).optional(),
});

export const aiModelsSchema = aiTestConnectionSchema.omit({ model: true });
export const aiPlaygroundSchema = z.object({
  message: z.string().trim().min(2).max(2000),
  profile: aiProfileSchema,
  system_prompt: z.string().min(1).max(10000),
  rag_enabled: z.boolean(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(12000) })).max(12).default([]),
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
