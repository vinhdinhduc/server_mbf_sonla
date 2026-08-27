import { z } from 'zod';

export const chatbotMessageSchema = z.object({
  session_id: z.string().min(1).max(100),
  message: z.string().min(1).max(2000),
});

export type ChatbotMessageDto = z.infer<typeof chatbotMessageSchema>;
