import { z } from 'zod';

export const trashTypeSchema = z.enum(['registration_groups', 'contacts', 'store_appointments']);

export const bulkDeleteSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(100),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export const trashIdParamsSchema = z.object({
  type: trashTypeSchema,
  id: z.coerce.number().int().positive(),
});
