import { z } from 'zod';

export const userRoleEnum = z.enum(['admin', 'chuyen_vien', 'giao_dich_vien', 'nhan_vien']);
export const userStatusEnum = z.enum(['active', 'locked']);
const publicProfileSchema = {
  store_id: z.coerce.number().int().positive().nullable().optional(),
  job_title: z.string().trim().max(100).nullable().optional(),
  is_public_profile: z
    .preprocess((value) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }, z.boolean())
    .optional(),
  public_phone: z
    .string()
    .regex(/^0\d{9}$/, 'Số điện thoại công việc phải có 10 chữ số')
    .nullable()
    .optional(),
  public_zalo: z
    .string()
    .regex(/^0\d{9}$/, 'Số Zalo công việc phải có 10 chữ số')
    .nullable()
    .optional(),
};

export const createUserSchema = z
  .object({
    ...publicProfileSchema,
    username: z.string().min(3).max(50),
    password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(100),
    full_name: z.string().min(1).max(100),
    email: z.string().email().max(100),
    phone: z.string().min(9).max(20),
    avatar_url: z
      .string()
      .max(500)
      .refine(
        (value) => value.startsWith('/uploads/') || /^https?:\/\//i.test(value),
        'Đường dẫn ảnh đại diện không hợp lệ',
      )
      .nullable()
      .optional(),
    role: userRoleEnum,
    status: userStatusEnum.default('active'),
  })
  .superRefine((value, context) => {
    if (value.role === 'giao_dich_vien' && !value.store_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['store_id'],
        message: 'Giao dịch viên phải thuộc một cửa hàng',
      });
    }
    if (value.is_public_profile && !value.public_phone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['public_phone'],
        message: 'Cần số điện thoại công việc để hiển thị công khai',
      });
    }
  });

export const updateUserSchema = createUserSchema
  .innerType()
  .partial()
  .omit({ password: true })
  .extend({
    password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(100).optional(),
  });

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
