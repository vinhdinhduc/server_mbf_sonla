import { z } from 'zod';
import { agreedTermsSchema } from '../utils/legalConsent';

export const registrationItemTypeEnum = z.enum(['sim', 'goi_cuoc', 'giai_phap', 'solution_plan']);
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
    .regex(/^[0-9+]+$/, 'Số điện thoại không hợp lệ'),
  email: z.union([z.string().email().max(150), z.literal('')]).optional().default(''),
  customer_type: z.enum(['individual', 'business']).default('individual'),
  agreed_terms: agreedTermsSchema,
  website: z.string().max(100).optional().default(''),
  source_utm: z.record(z.string().max(100)).optional(),
  note: z.string().optional().nullable(),
  delivery_method: z.enum(['address', 'store']),
  sim_type: z.enum(['physical', 'esim']),
  delivery_store: z.string().max(255).optional().nullable(),
  province: z.literal('Sơn La'),
  ward: z.string().min(1).max(100),
  delivery_address: z.string().max(255).optional().nullable(),
  items: z.array(submitCartItemSchema).min(1, 'Giỏ hàng không được để trống'),
  recaptcha_token: z.string().min(1, 'Thiếu recaptcha_token'),
}).superRefine((value, context) => {
  if (value.website) context.addIssue({ code: 'custom', path: ['website'], message: 'Yêu cầu không hợp lệ' });
  if (value.delivery_method === 'address') {
    if (!value.ward) context.addIssue({ code: 'custom', path: ['ward'], message: 'Vui lòng chọn xã/phường Sơn La' });
    if (!value.delivery_address) context.addIssue({ code: 'custom', path: ['delivery_address'], message: 'Vui lòng nhập địa chỉ nhận hàng' });
  }
  if (value.delivery_method === 'store' && !value.delivery_store) {
    context.addIssue({ code: 'custom', path: ['delivery_store'], message: 'Vui lòng chọn cửa hàng nhận SIM' });
  }
});

export const updateRegistrationGroupSchema = z.object({
  status: registrationStatusEnum.optional(),
  assigned_to: z.coerce.number().int().positive().nullable().optional(),
  store_id: z.coerce.number().int().positive().nullable().optional(),
  note: z.string().max(1000).optional(),
});

export const listRegistrationQuerySchema = z.object({
  status: registrationStatusEnum.optional(),
  search: z.string().max(100).optional(),
  store_id: z.coerce.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(20),
});

export type SubmitCartDto = z.infer<typeof submitCartSchema>;
export type UpdateRegistrationGroupDto = z.infer<typeof updateRegistrationGroupSchema>;
