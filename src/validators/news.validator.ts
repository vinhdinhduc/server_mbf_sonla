import { z } from 'zod';

export const newsCategoryEnum = z.enum(['khuyen_mai', 'su_kien', 'thong_bao']);
export const newsStatusEnum = z.enum(['draft', 'scheduled', 'published', 'archived']);
const nullableUrl = z
  .union([
    z.string().url().max(500),
    z.string().regex(/^\/uploads\/[A-Za-z0-9._/-]+$/),
    z.literal(''),
  ])
  .optional()
  .nullable();
const booleanValue = z.preprocess(
  (value) => value === true || value === 'true' || value === 1 || value === '1',
  z.boolean(),
);
const tagsValue = z.preprocess(
  (value) => (typeof value === 'string' ? value.split(',') : value),
  z.array(z.string().trim().min(1).max(80)).max(20).optional(),
);

const newsFields = z.object({
  title: z.string().trim().min(1).max(255),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang'),
  category: newsCategoryEnum,
  category_id: z.coerce.number().int().positive().optional().nullable(),
  thumbnail: nullableUrl,
  cover_url: nullableUrl,
  cover_alt: z.string().trim().max(255).optional().nullable(),
  summary: z.string().trim().max(300).optional().nullable(),
  content: z.string().min(1),
  status: newsStatusEnum.default('draft'),
  published_at: z.coerce.date().optional().nullable(),
  is_featured: booleanValue.default(false),
  is_pinned: booleanValue.default(false),
  seo_title: z.string().trim().max(60).optional().nullable(),
  seo_description: z.string().trim().max(160).optional().nullable(),
  og_image_url: nullableUrl,
  canonical_url: z
    .union([z.string().url().max(500), z.literal('')])
    .optional()
    .nullable(),
  tags: tagsValue,
});
const validateSchedule = (
  value: { status?: string; published_at?: Date | null },
  context: z.RefinementCtx,
) => {
  if (value.status === 'scheduled' && (!value.published_at || value.published_at <= new Date()))
    context.addIssue({
      code: 'custom',
      path: ['published_at'],
      message: 'Ngày đăng phải ở tương lai',
    });
};

export const createNewsSchema = newsFields.superRefine(validateSchedule);
export const updateNewsSchema = newsFields.partial().superRefine(validateSchedule);
export const listNewsQuerySchema = z.object({
  category: newsCategoryEnum.optional(),
  status: newsStatusEnum.optional(),
  search: z.string().max(100).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  author_id: z.coerce.number().int().positive().optional(),
  featured: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(10),
});
export const autosaveNewsSchema = z.object({ content: z.string().max(2_000_000) });
export type CreateNewsDto = z.infer<typeof createNewsSchema>;
export type UpdateNewsDto = z.infer<typeof updateNewsSchema>;
