import { isStoreOpenNow, parseOpeningSlots } from '../../src/utils/storeHours';
import { displayHours } from '../../src/services/store.service';

describe('M06 TC-16 - trạng thái mở cửa theo giờ Việt Nam', () => {
  const slots = [{ days: [1, 2, 3, 4, 5, 6], open: '07:30', close: '17:30' }];

  it('mở lúc 08:00 thứ Hai tại Sơn La', () => {
    expect(isStoreOpenNow(slots, new Date('2026-09-21T01:00:00Z'))).toBe(true);
  });

  it('đóng lúc 20:00 thứ Hai và cả ngày Chủ Nhật', () => {
    expect(isStoreOpenNow(slots, new Date('2026-09-21T13:00:00Z'))).toBe(false);
    expect(isStoreOpenNow(slots, new Date('2026-09-20T03:00:00Z'))).toBe(false);
  });

  it('hiển thị gọn T2–T7 đúng chuẩn tiếng Việt', () => {
    expect(displayHours(slots)).toBe('07:30 – 17:30 (T2 – T7)');
  });

  it('đọc giờ JSON khi MySQL trả về chuỗi', () => {
    expect(parseOpeningSlots(JSON.stringify(slots))).toEqual(slots);
    expect(parseOpeningSlots('không phải JSON')).toBeNull();
  });
});
