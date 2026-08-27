import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Vui long nhap ten dang nhap'),
  password: z.string().min(1, 'Vui long nhap mat khau'),
});

export type LoginDto = z.infer<typeof loginSchema>;
