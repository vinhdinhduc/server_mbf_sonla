import { createStoreSchema } from '../../src/validators/store.validator';

const valid = {
  name: 'Cửa hàng Tô Hiệu',
  street_address: '96B Đường 3/2',
  ward_name: 'Phường Tô Hiệu',
  phone: '0912345678',
  lat: 21.3256,
  lng: 103.9188,
  opening_hours_json: [{ days: [1, 2, 3, 4, 5, 6], open: '07:30', close: '17:30' }],
  status: 'active',
};

describe('M06 TC-13/14 - địa chỉ và giờ mở cửa', () => {
  it('chấp nhận tên phường và lịch T2–T7', () => {
    expect(createStoreSchema.safeParse(valid).success).toBe(true);
  });

  it('cho phép xã/phường trống và từ chối tọa độ ngoài Việt Nam, giờ đóng trước giờ mở', () => {
    expect(createStoreSchema.safeParse({ ...valid, ward_name: null }).success).toBe(true);
    expect(createStoreSchema.safeParse({ ...valid, ward_name: '' }).success).toBe(true);
    expect(createStoreSchema.safeParse({ ...valid, lat: 40 }).success).toBe(false);
    expect(createStoreSchema.safeParse({ ...valid, opening_hours_json: [{ days: [1], open: '08:00', close: '07:00' }] }).success).toBe(false);
  });

  it('từ chối hai khung giờ chồng lấn cùng ngày', () => {
    const result = createStoreSchema.safeParse({ ...valid, opening_hours_json: [
      { days: [1], open: '07:30', close: '11:30' },
      { days: [1], open: '11:00', close: '17:30' },
    ] });
    expect(result.success).toBe(false);
  });
});
