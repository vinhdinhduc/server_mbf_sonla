import { z } from 'zod';
import { agreedTermsSchema } from '../utils/legalConsent';

export const contactStatusEnum = z.enum(['moi', 'dang_xu_ly', 'da_phan_hoi']);
export const createContactSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    phone: z
      .string()
      .trim()
      .regex(/^(0|\+84)\d{9}$/, 'Số điện thoại không hợp lệ'),
    email: z.string().email().max(100),
    topic: z.enum(['package', 'sim', 'solution', 'support', 'other']),
    store_id: z.coerce.number().int().positive().optional().nullable(),
    message: z.string().trim().min(1).max(1000),
    agreed_terms: agreedTermsSchema,
    website: z.string().max(100).optional().default(''),
    recaptcha_token: z.string().min(1, 'Thiếu recaptcha_token'),
  })
  .superRefine((value, context) => {
    if (value.website)
      context.addIssue({ code: 'custom', path: ['website'], message: 'Yêu cầu không hợp lệ' });
  });
export const updateContactSchema = z.object({
  status: contactStatusEnum.optional(),
  assigned_to: z.coerce.number().int().positive().nullable().optional(),
  internal_note: z.string().max(2000).nullable().optional(),
});
export type CreateContactDto = z.infer<typeof createContactSchema>;
export type UpdateContactDto = z.infer<typeof updateContactSchema>;
