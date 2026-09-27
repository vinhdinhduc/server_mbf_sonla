import { z } from 'zod';

export const simCatalogEnum = z.enum([
  'so_dep',
  'phong_thuy',
  'nam_sinh',
  'tra_truoc',
  'sim_data',
  'esim',
]);
export const simTypeEnum = z.enum(['tam_hoa', 'tu_quy', 'phat_loc', 'than_tai', 'thuong']);
export const simStatusEnum = z.enum(['available', 'reserved', 'sold', 'hidden']);
export const subscriptionTypeEnum = z.enum(['prepaid', 'postpaid']);

export const createSimSchema = z.object({
  phone_number: z.string().regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0'),
  subscription_type: subscriptionTypeEnum,
  catalog: simCatalogEnum,
  sim_type: simTypeEnum,
  price: z.coerce.number().nonnegative().optional().nullable(),
  bundle_note: z.string().max(255).optional().nullable(),
  committed_monthly_fee: z.preprocess(
    (value) => (value === '' ? null : value),
    z.coerce.number().int().min(0).max(999999999999).nullable().optional(),
  ),
  commitment_months: z.coerce.number().int().min(0).max(36).optional().nullable(),
  status: simStatusEnum.default('available'),
});

export const updateSimSchema = createSimSchema.partial();

export const listSimQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(10)
    .regex(/^[0-9*]+$/, 'Chỉ được nhập chữ số và dấu *')
    .optional(),
  prefix: z.string().optional(),
  catalog: simCatalogEnum.optional(),
  sim_type: simTypeEnum.optional(),
  price_range: z.string().optional(), // vd "0-500000"
  type: subscriptionTypeEnum.default('postpaid'),
});

export const listAdminSimQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(10)
    .regex(/^[0-9*]+$/, 'Chỉ được nhập chữ số và dấu *')
    .optional(),
  prefix: z
    .string()
    .regex(/^0\d{2}$/)
    .optional(),
  catalog: simCatalogEnum.optional(),
  sim_type: simTypeEnum.optional(),
  type: subscriptionTypeEnum.optional(),
  status: simStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(50).default(20),
  sort: z.enum(['created_at', 'phone_number', 'status']).default('created_at'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

export const exportSimQuerySchema = listAdminSimQuerySchema
  .omit({ page: true, page_size: true, sort: true, direction: true })
  .extend({
    format: z.enum(['xlsx', 'csv']).default('xlsx'),
    scope: z.enum(['filtered', 'all']).default('filtered'),
    columns: z
      .string()
      .optional()
      .transform(
        (value) =>
          value?.split(',') ?? [
            'phone',
            'subscription',
            'catalog',
            'pattern',
            'fee',
            'commitment',
            'status',
            'note',
            'createdAt',
          ],
      )
      .pipe(
        z
          .array(
            z.enum([
              'phone',
              'subscription',
              'catalog',
              'pattern',
              'fee',
              'commitment',
              'status',
              'note',
              'createdAt',
            ]),
          )
          .min(1)
          .max(9)
          .refine((values) => new Set(values).size === values.length, 'Cột xuất dữ liệu bị trùng'),
      ),
  });

export const bulkSimStatusSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(1000),
  status: simStatusEnum,
});

export const bulkSimDeleteSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(1000),
});

export type CreateSimDto = z.infer<typeof createSimSchema>;
export type UpdateSimDto = z.infer<typeof updateSimSchema>;
