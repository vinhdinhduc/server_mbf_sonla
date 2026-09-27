import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export const requestResetSchema = z.object({ identifier: z.string().trim().min(1).max(100) });
const challenge = z.string().regex(/^[a-f0-9]{64}$/);
export const verifyResetSchema = z.object({
  challenge,
  otp: z.string().regex(/^\d{6}$/, 'Mã OTP phải gồm 6 chữ số'),
});
export const resetPasswordSchema = z
  .object({
    challenge,
    reset_token: challenge,
    password: z
      .string()
      .min(8)
      .max(72)
      .regex(/[A-Z]/, 'Cần có chữ hoa')
      .regex(/[a-z]/, 'Cần có chữ thường')
      .regex(/[0-9]/, 'Cần có chữ số')
      .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Mật khẩu tối đa 72 byte'),
    confirm_password: z.string(),
  })
  .refine((v) => v.password === v.confirm_password, {
    path: ['confirm_password'],
    message: 'Mật khẩu xác nhận không khớp',
  });

export type LoginDto = z.infer<typeof loginSchema>;
