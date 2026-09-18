import { z } from 'zod';

export const aiProviderEnum = z.enum(['openai', 'anthropic', 'gemini']);
export const aiSettingsSchema = z.object({
  provider: aiProviderEnum,
  model: z.string().min(1).max(150),
  api_key: z.string().max(500).optional(),
  temperature: z.coerce.number().min(0).max(1),
  max_tokens: z.coerce.number().int().min(20).max(4000),
  top_p: z.coerce.number().min(0).max(1),
  system_prompt: z.string().min(1).max(10000),
  daily_limit: z.coerce.number().int().min(1).max(10000),
  rag_enabled: z.coerce.boolean(),
  enabled: z.coerce.boolean(),
});

export const aiTestConnectionSchema = z.object({
  provider: aiProviderEnum,
  model: z.string().min(1).max(150),
  api_key: z.string().max(500).optional(),
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
