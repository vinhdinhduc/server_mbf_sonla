import { z } from 'zod';

export const userRoleEnum = z.enum(['admin', 'chuyen_vien', 'giao_dich_vien', 'nhan_vien']);
export const userStatusEnum = z.enum(['active', 'locked']);

export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  full_name: z.string().min(1).max(100),
  email: z.string().email().max(100),
  phone: z.string().min(9).max(20),
  role: userRoleEnum,
  status: userStatusEnum.default('active'),
});

export const updateUserSchema = createUserSchema
  .partial()
  .omit({ password: true })
  .extend({
    password: z.string().min(6).max(100).optional(),
  });

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
