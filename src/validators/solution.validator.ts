import { z } from 'zod';

export const solutionCategoryEnum = z.enum([
  'sme',
  'ubnd',
  'ho_kinh_doanh',
  'cuc_nganh',
  'chuyen_doi_so',
]);
export const solutionStatusEnum = z.enum(['active', 'inactive']);

const solutionFeatureSchema = z.object({
  icon: z.string().max(100).optional().nullable(),
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  sort_order: z.coerce.number().int().min(0).default(0),
});
const solutionPricingSchema = z.object({
  package_code: z.string().min(1).max(50),
  package_name: z.string().min(1).max(255),
  price: z.coerce.number().min(0),
  cycle_months: z.coerce.number().int().positive().default(1),
  condition_note: z.string().max(255).optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
  sort_order: z.coerce.number().int().min(0).default(0),
});
const solutionFaqSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().optional().nullable(),
  sort_order: z.coerce.number().int().min(0).default(0),
});
const solutionGallerySchema = z.object({
  image_url: z.string().min(1).max(255),
  caption: z.string().max(255).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).default(0),
});
const solutionStepSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  icon: z.string().max(100).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export const createSolutionSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  category: solutionCategoryEnum,
  thumbnail: z.string().max(255).optional().nullable(),
  summary: z.string().optional().nullable(),
  content: z.string().min(1),
  target_customers: z.string().optional().nullable(),
  legal_basis: z.string().optional().nullable(),
  brochure_url: z.string().max(255).optional().nullable(),
  video_url: z.string().max(255).optional().nullable(),
  is_hot: z.coerce.boolean().default(false),
  status: solutionStatusEnum.default('active'),
  hero_badge: z.string().max(100).optional().nullable(),
  hero_title: z.string().max(255).optional().nullable(),
  hero_subtitle: z.string().optional().nullable(),
  cta_label: z.string().max(100).optional().nullable(),
  cta_url: z.string().max(255).optional().nullable(),
  audience_cards: z.array(z.object({ icon: z.string().max(100), title: z.string().min(1).max(255), description: z.string() })).optional().nullable(),
  section_visibility: z.record(z.boolean()).optional().nullable(),
  section_titles: z.record(z.string().max(255)).optional().nullable(),
  seo_title: z.string().max(60).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
  features: z.array(solutionFeatureSchema).optional(),
  pricing: z.array(solutionPricingSchema).optional(),
  faqs: z.array(solutionFaqSchema).optional(),
  gallery: z.array(solutionGallerySchema).optional(),
  steps: z.array(solutionStepSchema).optional(),
});

export const updateSolutionSchema = createSolutionSchema.partial();

export const listSolutionQuerySchema = z.object({
  category: solutionCategoryEnum.optional(),
  is_hot: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  page_size: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateSolutionDto = z.infer<typeof createSolutionSchema>;
export type UpdateSolutionDto = z.infer<typeof updateSolutionSchema>;
