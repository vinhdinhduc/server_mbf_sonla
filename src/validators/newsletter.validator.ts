import { z } from 'zod';

export const subscribeNewsletterSchema = z.object({
  email: z.string().email().max(100),
});

export type SubscribeNewsletterDto = z.infer<typeof subscribeNewsletterSchema>;
