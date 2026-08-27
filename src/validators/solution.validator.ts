import { z } from 'zod';

export const solutionCategoryEnum = z.enum(['sme', 'ubnd', 'ho_kinh_doanh', 'cuc_nganh']);
export const solutionStatusEnum = z.enum(['active', 'inactive']);

export const createSolutionSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  category: solutionCategoryEnum,
  thumbnail: z.string().max(255).optional().nullable(),
  summary: z.string().optional().nullable(),
  content: z.string().min(1),
  is_hot: z.coerce.boolean().default(false),
  status: solutionStatusEnum.default('active'),
});

export const updateSolutionSchema = createSolutionSchema.partial();

export const listSolutionQuerySchema = z.object({
  category: solutionCategoryEnum.optional(),
});

export type CreateSolutionDto = z.infer<typeof createSolutionSchema>;
export type UpdateSolutionDto = z.infer<typeof updateSolutionSchema>;
