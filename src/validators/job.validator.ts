import { z } from 'zod';
import { agreedTermsSchema } from '../utils/legalConsent';

const html = z.string().min(1).max(2_000_000);
export const jobSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(255),
    category: z.string().trim().min(1).max(100),
    level: z.string().max(80).optional().nullable(),
    employment_type: z.enum(['full_time', 'part_time', 'contract', 'internship']),
    store_id: z.coerce.number().int().positive().optional().nullable(),
    location: z.string().trim().min(1).max(255),
    quantity: z.coerce.number().int().min(1).max(1000),
    salary_min: z.coerce.number().nonnegative().optional().nullable(),
    salary_max: z.coerce.number().nonnegative().optional().nullable(),
    salary_type: z.enum(['range', 'negotiable', 'hidden']),
    description: html,
    requirements: html.optional().nullable(),
    benefits: html.optional().nullable(),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    is_hot: z.preprocess((v) => v === true || v === 'true', z.boolean()).default(false),
    is_urgent: z.preprocess((v) => v === true || v === 'true', z.boolean()).default(false),
    status: z.enum(['draft', 'recruiting', 'paused']),
  })
  .refine(
    (v) =>
      v.salary_type !== 'range' ||
      (v.salary_min != null && v.salary_max != null && v.salary_max >= v.salary_min),
    { path: ['salary_max'], message: 'Khoảng lương không hợp lệ' },
  );
export const updateJobSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(255)
    .optional(),
  category: z.string().trim().min(1).max(100).optional(),
  level: z.string().max(80).optional().nullable(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'internship']).optional(),
  store_id: z.coerce.number().int().positive().optional().nullable(),
  location: z.string().trim().min(1).max(255).optional(),
  quantity: z.coerce.number().int().min(1).max(1000).optional(),
  salary_min: z.coerce.number().nonnegative().optional().nullable(),
  salary_max: z.coerce.number().nonnegative().optional().nullable(),
  salary_type: z.enum(['range', 'negotiable', 'hidden']).optional(),
  description: html.optional(),
  requirements: html.optional().nullable(),
  benefits: html.optional().nullable(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  is_hot: z.preprocess((v) => v === true || v === 'true', z.boolean()).optional(),
  is_urgent: z.preprocess((v) => v === true || v === 'true', z.boolean()).optional(),
  status: z.enum(['draft', 'recruiting', 'paused']).optional(),
});
export const applyJobSchema = z
  .object({
    job_id: z.coerce.number().int().positive().optional().nullable(),
    full_name: z.string().trim().min(1).max(100),
    phone: z.string().regex(/^(0|\+84)\d{9}$/),
    email: z.string().email().max(150),
    introduction: z.string().max(2000).optional().nullable(),
    agreed_terms: z.preprocess((v) => v === 'true' ? true : v, agreedTermsSchema),
    website: z.string().max(100).optional().default(''),
    recaptcha_token: z.string().min(1),
  })
  .refine((v) => !v.website, { path: ['website'], message: 'Yêu cầu không hợp lệ' });
export const updateApplicationSchema = z.object({
  status: z.enum(['new', 'screening', 'interview', 'accepted', 'rejected']).optional(),
  internal_note: z.string().max(3000).optional().nullable(),
});
export type JobDto = z.infer<typeof jobSchema>;
export type UpdateJobDto = z.infer<typeof updateJobSchema>;
