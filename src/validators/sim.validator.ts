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
export const simStatusEnum = z.enum(['available', 'reserved', 'sold']);

export const createSimSchema = z.object({
  phone_number: z.string().min(9).max(15),
  prefix: z.string().min(2).max(5),
  catalog: simCatalogEnum,
  sim_type: simTypeEnum,
  price: z.coerce.number().nonnegative(),
  bundle_note: z.string().max(255).optional().nullable(),
  commitment_months: z.coerce.number().int().nonnegative().optional().nullable(),
  status: simStatusEnum.default('available'),
});

export const updateSimSchema = createSimSchema.partial();

export const listSimQuerySchema = z.object({
  prefix: z.string().optional(),
  sim_type: simTypeEnum.optional(),
  price_range: z.string().optional(), // vd "0-500000"
});

export type CreateSimDto = z.infer<typeof createSimSchema>;
export type UpdateSimDto = z.infer<typeof updateSimSchema>;
