import { createUserSchema } from '../../src/validators/user.validator';

const valid = {
  username: 'tester123', password: 'Password123!', full_name: 'Giao dịch viên',
  email: 'tester@example.test', phone: '0912345678', role: 'giao_dich_vien' as const, status: 'active' as const,
};

describe('M06/M09: dữ liệu giao dịch viên', () => {
  it('không tạo giao dịch viên thiếu cửa hàng', () => {
    const result = createUserSchema.safeParse(valid);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['store_id']);
  });

  it('không công bố hồ sơ nếu thiếu số điện thoại công việc', () => {
    const result = createUserSchema.safeParse({ ...valid, store_id: 1, is_public_profile: true });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['public_phone']);
  });

  it('cho phép hồ sơ riêng tư có cửa hàng', () => {
    expect(createUserSchema.safeParse({ ...valid, store_id: 1, is_public_profile: false }).success).toBe(true);
  });
});
