import { z } from 'zod';

export const packageGroupTypeEnum = z.enum(['hot', 'tra_truoc', 'tra_sau', 'wifi_5g']);
export const packageDurationUnitEnum = z.enum(['ngay', 'thang']);
export const packageStatusEnum = z.enum(['active', 'inactive', 'hidden']);

export const createPackageSchema = z.object({
  code: z.string().min(1).max(20).transform((v) => v.trim().toUpperCase()),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(255),
  group_type: packageGroupTypeEnum,
  headline_desc: z.string().max(100).optional().nullable(),
  price: z.coerce.number().nonnegative(),
  duration_value: z.coerce.number().int().positive(),
  duration_unit: packageDurationUnitEnum,
  data_desc: z.string().max(255).optional().nullable(),
  call_desc: z.string().max(255).optional().nullable(),
  sms_desc: z.string().max(255).optional().nullable(),
  speed_desc: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  status: packageStatusEnum.default('active'),
  display_order: z.coerce.number().int().default(0),
  service_type: z.enum(['mobile', 'data', 'wifi_5g', 'combo']).default('mobile'),
  subscription_type: z.enum(['prepaid', 'postpaid', 'none']).default('none'),
  badges: z.array(z.enum(['hot', 'new', 'bestseller'])).default([]),
  data_per_day_gb: z.coerce.number().nonnegative().optional().nullable(),
  data_per_cycle_gb: z.coerce.number().nonnegative().optional().nullable(),
  unlimited_data: z.preprocess((value) => value === true || value === 'true' || value === '1', z.boolean()).default(false),
  benefits: z.array(z.string().max(255)).default([]),
  conditions: z.string().optional().nullable(),
  audience: z.string().max(255).optional().nullable(),
  sms_syntax: z.string().max(255).optional().nullable(),
  image_url: z.string().max(255).optional().nullable(),
  effective_from: z.coerce.date().optional().nullable(),
  effective_to: z.coerce.date().optional().nullable(),
});

export const updatePackageSchema = createPackageSchema.partial();

export const listPackageQuerySchema = z.object({
  group_type: packageGroupTypeEnum.optional(),
});

export type CreatePackageDto = z.infer<typeof createPackageSchema>;
export type UpdatePackageDto = z.infer<typeof updatePackageSchema>;
