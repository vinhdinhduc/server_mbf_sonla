import { z } from 'zod';

export const registrationItemTypeEnum = z.enum(['sim', 'goi_cuoc', 'giai_phap']);
export const registrationStatusEnum = z.enum(['moi', 'dang_xu_ly', 'hoan_thanh', 'huy']);

export const submitCartItemSchema = z.object({
  type: registrationItemTypeEnum,
  reference_id: z.coerce.number().int().positive(),
});

export const submitCartSchema = z.object({
  customer_name: z.string().min(1).max(100),
  phone: z
    .string()
    .min(9)
    .max(20)
    .regex(/^[0-9+]+$/, 'So dien thoai khong hop le'),
  note: z.string().optional().nullable(),
  items: z.array(submitCartItemSchema).min(1, 'Gio hang khong duoc de trong'),
  recaptcha_token: z.string().min(1, 'Thieu recaptcha_token'),
});

export const updateRegistrationGroupSchema = z.object({
  status: registrationStatusEnum.optional(),
  assigned_to: z.coerce.number().int().positive().nullable().optional(),
});

export const listRegistrationQuerySchema = z.object({
  status: registrationStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(20),
});

export type SubmitCartDto = z.infer<typeof submitCartSchema>;
export type UpdateRegistrationGroupDto = z.infer<typeof updateRegistrationGroupSchema>;
