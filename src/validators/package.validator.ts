import { z } from 'zod';

export const packageGroupTypeEnum = z.enum(['hot', 'tra_truoc', 'tra_sau', 'wifi_5g']);
export const packageDurationUnitEnum = z.enum(['ngay', 'thang']);
export const packageStatusEnum = z.enum(['active', 'inactive']);

export const createPackageSchema = z.object({
  code: z.string().min(1).max(20),
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
});

export const updatePackageSchema = createPackageSchema.partial();

export const listPackageQuerySchema = z.object({
  group_type: packageGroupTypeEnum.optional(),
});

export type CreatePackageDto = z.infer<typeof createPackageSchema>;
export type UpdatePackageDto = z.infer<typeof updatePackageSchema>;
