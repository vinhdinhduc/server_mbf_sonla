import { z } from 'zod';

export const chatbotMessageSchema = z.object({
  session_id: z.string().min(1).max(100),
  message: z.string().min(1).max(2000),
});

export type ChatbotMessageDto = z.infer<typeof chatbotMessageSchema>;

export const chatbotFeedbackSchema = z.object({
  session_id: z.string().min(1).max(100),
  answer_id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  was_helpful: z.boolean(),
  comment: z.string().trim().max(500).optional(),
});
