import { z } from 'zod';
import { agreedTermsSchema } from '../utils/legalConsent';

export const chatbotMessageSchema = z.object({
  agreed_terms: agreedTermsSchema,
  session_id: z.string().min(1).max(100),
  message: z.string().min(1).max(2000),
});

export type ChatbotMessageDto = z.infer<typeof chatbotMessageSchema>;
