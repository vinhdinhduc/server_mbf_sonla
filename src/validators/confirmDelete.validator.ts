import { z } from 'zod';

export const confirmDeleteSchema = z.object({
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});
