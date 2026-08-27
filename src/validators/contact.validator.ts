import { z } from 'zod';

export const contactStatusEnum = z.enum(['moi', 'da_xu_ly']);

export const createContactSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(9).max(20),
  email: z.string().email().max(100),
  message: z.string().min(1),
  recaptcha_token: z.string().min(1, 'Thieu recaptcha_token'),
});

export const updateContactSchema = z.object({
  status: contactStatusEnum,
});

export type CreateContactDto = z.infer<typeof createContactSchema>;
export type UpdateContactDto = z.infer<typeof updateContactSchema>;
