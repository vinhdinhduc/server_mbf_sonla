import { z } from 'zod';
import { agreedTermsSchema } from '../utils/legalConsent';

export const subscribeNewsletterSchema = z.object({
  agreed_terms: agreedTermsSchema,
  email: z.string().email().max(100),
});

export type SubscribeNewsletterDto = z.infer<typeof subscribeNewsletterSchema>;
