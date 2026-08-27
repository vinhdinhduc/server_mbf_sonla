import { z } from 'zod';

export const newsCategoryEnum = z.enum(['khuyen_mai', 'su_kien', 'thong_bao']);
export const newsStatusEnum = z.enum(['draft', 'published']);

export const createNewsSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  category: newsCategoryEnum,
  thumbnail: z.string().max(255).optional().nullable(),
  summary: z.string().optional().nullable(),
  content: z.string().min(1),
  status: newsStatusEnum.default('draft'),
  published_at: z.coerce.date().optional().nullable(),
});

export const updateNewsSchema = createNewsSchema.partial();

export const listNewsQuerySchema = z.object({
  category: newsCategoryEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(10),
});

export type CreateNewsDto = z.infer<typeof createNewsSchema>;
export type UpdateNewsDto = z.infer<typeof updateNewsSchema>;
