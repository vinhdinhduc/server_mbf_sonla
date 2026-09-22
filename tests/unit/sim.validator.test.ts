import {
  createSimSchema,
  bulkSimStatusSchema,
  listAdminSimQuerySchema,
  listSimQuerySchema,
  exportSimQuerySchema,
} from '../../src/validators/sim.validator';

describe('sim.validator', () => {
  it('chấp nhận bộ lọc wildcard an toàn và giữ hình thức thuê bao', () => {
    expect(listSimQuerySchema.parse({ q: '*68', type: 'prepaid' })).toMatchObject({
      q: '*68',
      type: 'prepaid',
    });
  });

  it('từ chối chuỗi tìm kiếm có ký tự SQL', () => {
    expect(() => listSimQuerySchema.parse({ q: "090*'; DROP" })).toThrow();
  });

  it('bắt buộc số điện thoại chuẩn và hình thức thuê bao', () => {
    const base = {
      phone_number: '0901234567',
      subscription_type: 'postpaid',
      catalog: 'so_dep',
      sim_type: 'thuong',
      status: 'available',
    };
    expect(createSimSchema.parse(base)).toMatchObject(base);
    expect(() => createSimSchema.parse({ ...base, phone_number: '901234567' })).toThrow();
    expect(() => createSimSchema.parse({ ...base, subscription_type: undefined })).toThrow();
  });

  it('chuẩn hóa phân trang admin và chặn sort tùy ý', () => {
    expect(listAdminSimQuerySchema.parse({ page: '2', page_size: '50' })).toMatchObject({
      page: 2,
      page_size: 50,
      sort: 'created_at',
      direction: 'desc',
    });
    expect(() => listAdminSimQuerySchema.parse({ sort: 'price; DROP TABLE sim_numbers' })).toThrow();
    expect(() => listAdminSimQuerySchema.parse({ page_size: 1000 })).toThrow();
  });

  it('validate thao tác hàng loạt', () => {
    expect(bulkSimStatusSchema.parse({ ids: [1, 2], status: 'hidden' })).toEqual({
      ids: [1, 2],
      status: 'hidden',
    });
    expect(() => bulkSimStatusSchema.parse({ ids: [], status: 'sold' })).toThrow();
  });

  it('chỉ cho xuất các cột hợp lệ, không trùng lặp', () => {
    expect(exportSimQuerySchema.parse({ scope: 'all', columns: 'phone,fee' }).columns).toEqual(['phone', 'fee']);
    expect(() => exportSimQuerySchema.parse({ columns: 'phone,password' })).toThrow();
    expect(() => exportSimQuerySchema.parse({ columns: 'phone,phone' })).toThrow();
    expect(() => exportSimQuerySchema.parse({ columns: '' })).toThrow();
  });
});
