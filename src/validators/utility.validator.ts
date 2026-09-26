import { z } from 'zod';

const url = z
  .union([z.string().url().max(1000), z.string().regex(/^\/uploads\//), z.literal('')])
  .optional()
  .nullable();
export const utilitySchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  summary: z.string().max(300).optional().nullable(),
  card_image: url,
  hero_image: url,
  content: z.string().max(2_000_000).optional().nullable(),
  features: z.preprocess(
    (v) =>
      typeof v === 'string'
        ? v
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean)
        : v,
    z.array(z.string().max(200)).max(30).optional().nullable(),
  ),
  ios_url: url,
  android_url: url,
  website_url: url,
  cta_type: z.enum(['download', 'website', 'call']).default('website'),
  cta_label: z.string().max(100).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).default(0),
  status: z.enum(['active', 'inactive']).default('active'),
});
export const updateUtilitySchema = utilitySchema.partial();
export const downloadSchema = z.object({
  title: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  file_url: z.string().url().max(1000),
  description: z.string().max(500).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).default(0),
  status: z.enum(['active', 'inactive']).default('active'),
});
