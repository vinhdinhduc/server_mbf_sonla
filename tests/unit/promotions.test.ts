import { Op } from 'sequelize';
import { sequelize } from '../../src/config/database';
import { Promotion } from '../../src/models/Promotion.model';
import { PromotionEvent } from '../../src/models/PromotionEvent.model';
import { promotionIsCurrent, promotionService } from '../../src/services/promotion.service';
import {
  createPromotionSchema, promotionEventSchema, publicPromotionQuerySchema, updatePromotionSchema,
} from '../../src/validators/promotion.validator';

jest.mock('../../src/config/database', () => ({ sequelize: { transaction: jest.fn() } }));
jest.mock('../../src/models/Promotion.model', () => ({
  Promotion: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
}));
jest.mock('../../src/models/PromotionEvent.model', () => ({
  PromotionEvent: { findOne: jest.fn(), create: jest.fn(), destroy: jest.fn() },
}));

const input = { name: 'Tháng 10', title: 'Bạn có quà!', content: 'Giảm 20% khi đăng ký' };
const transaction = { LOCK: { UPDATE: 'UPDATE' } };
const now = new Date('2026-10-13T03:00:00Z');
function row(overrides: Record<string, unknown> = {}) {
  const values = {
    ...createPromotionSchema.parse(input), id: 1, is_active: true,
    impression_count: 7, open_count: 2, cta_count: 1, created_at: now, updated_at: now, ...overrides,
  };
  return { ...values, toJSON: () => ({ ...values }), increment: jest.fn(), update: jest.fn(), destroy: jest.fn() };
}

beforeEach(() => {
  (sequelize.transaction as jest.Mock).mockImplementation((callback) => callback(transaction));
  (PromotionEvent.destroy as jest.Mock).mockResolvedValue(0);
});

describe('promotion input safety', () => {
  test.each(['javascript:alert(1)', 'data:text/html,test', '//outside.test', '/\\outside.test', 'https://x.test/\nscript', 'https://user:pass@x.test'])('rejects unsafe links and images %s', (value) => {
    for (const field of ['cta_link', 'image_url']) {
      expect(createPromotionSchema.safeParse({ ...input, [field]: value }).success).toBe(false);
    }
  });
  test('accepts safe URLs and normalizes exact target pages without query/hash', () => {
    const dto = createPromotionSchema.parse({ ...input, cta_text: 'Đăng ký', cta_link: '/dang-ky?utm=qua', image_url: 'https://cdn.test/banner.webp', target_pages: ['/', '/goi-cuoc/', '/goi-cuoc'] });
    expect(dto.target_pages).toEqual(['/', '/goi-cuoc']);
    expect(createPromotionSchema.safeParse({ ...input, target_pages: ['/goi-cuoc?utm=qua'] }).success).toBe(false);
    expect(publicPromotionQuerySchema.parse({ path: '/goi-cuoc/?utm=qua', device: 'mobile' }).path).toBe('/goi-cuoc');
  });
  test('validates schedule, percentages, dates, booleans, UUIDs and read-only fields', () => {
    expect(createPromotionSchema.safeParse({ ...input, start_at: '2026-10-15T12:00:00Z', end_at: '2026-10-14T12:00:00Z' }).success).toBe(false);
    expect(createPromotionSchema.safeParse({ ...input, start_at: '2026-10-14T12:00:00' }).success).toBe(false);
    expect(createPromotionSchema.safeParse({ ...input, trigger_type: 'scroll', trigger_value: 101 }).success).toBe(false);
    expect(createPromotionSchema.safeParse({ ...input, trigger_type: 'delay', trigger_value: 3601 }).success).toBe(false);
    expect(createPromotionSchema.safeParse({ ...input, is_active: 'false' }).success).toBe(false);
    expect(updatePromotionSchema.safeParse({ impression_count: 900 }).success).toBe(false);
    expect(promotionEventSchema.safeParse({ event: 'open', visit_id: 'not-a-uuid' }).success).toBe(false);
    expect(updatePromotionSchema.parse({ is_active: false })).toEqual({ is_active: false });
    expect(createPromotionSchema.safeParse({ ...input, cta_link: '/dang-ky' }).success).toBe(false);
    expect(createPromotionSchema.safeParse({ ...input, cta_text: 'Đăng ký' }).success).toBe(false);
  });
});

describe('promotion selection and updates', () => {
  test('public selection filters current schedule/device in storage and exact paths, with no internal fields', async () => {
    (Promotion.findAll as jest.Mock).mockResolvedValue([
      row({ id: 1, target_pages: [] }), row({ id: 2, target_pages: ['/'] }),
      row({ id: 3, target_pages: ['/goi-cuoc'] }), row({ id: 4, target_pages: ['/goi-cuoc/extra'] }),
    ]);
    const result = await promotionService.listPublic({ path: '/goi-cuoc/', device: 'mobile' });
    expect(result.map((promotion) => promotion.id)).toEqual([1, 3]);
    for (const promotion of result) {
      expect(promotion).not.toHaveProperty('name');
      expect(promotion).not.toHaveProperty('impression_count');
      expect(promotion).not.toHaveProperty('open_count');
      expect(promotion).not.toHaveProperty('cta_count');
    }
    const options = (Promotion.findAll as jest.Mock).mock.calls[0][0];
    expect(options.where.is_active).toBe(true);
    expect(options.where.device[Op.in]).toEqual(['all', 'mobile']);
    expect(options.where[Op.and][0][Op.or][1].start_at[Op.lte]).toBeInstanceOf(Date);
    expect(options.where[Op.and][1][Op.or][1].end_at[Op.gt]).toBeInstanceOf(Date);
    expect(options.order).toEqual([['created_at', 'DESC'], ['id', 'DESC']]);
  });
  test('partial updates validate stored schedule and trigger settings before writing', async () => {
    const promotion = row({ start_at: new Date('2026-10-15T12:00:00Z'), end_at: new Date('2026-10-16T12:00:00Z'), trigger_type: 'delay', trigger_value: 300 });
    (Promotion.findByPk as jest.Mock).mockResolvedValue(promotion);
    await expect(promotionService.update(1, updatePromotionSchema.parse({ end_at: '2026-10-14T12:00:00Z' }))).rejects.toThrow('Ngày kết thúc');
    await expect(promotionService.update(1, { trigger_type: 'scroll' })).rejects.toThrow('Tỷ lệ cuộn');
    await expect(promotionService.update(1, { cta_link: '/dang-ky' })).rejects.toThrow('Nút kêu gọi');
    expect(promotion.update).not.toHaveBeenCalled();
    const result = await promotionService.update(1, { is_active: false });
    expect(result.previous.is_active).toBe(true);
    expect(promotion.update).toHaveBeenCalledWith({ is_active: false }, { transaction });
    expect(Promotion.findByPk).toHaveBeenCalledWith(1, { transaction, lock: 'UPDATE' });
  });
  test('active bounds are inclusive at start and exclusive at end', () => {
    expect(promotionIsCurrent({ is_active: true, start_at: now, end_at: null }, now)).toBe(true);
    expect(promotionIsCurrent({ is_active: true, start_at: null, end_at: now }, now)).toBe(false);
    expect(promotionIsCurrent({ is_active: false, start_at: null, end_at: null }, now)).toBe(false);
  });
});

describe('event counters', () => {
  test.each(['impression', 'open', 'cta'] as const)('increments %s atomically once per experience UUID and event', async (event) => {
    const promotion = row();
    (Promotion.findByPk as jest.Mock).mockResolvedValue(promotion);
    (PromotionEvent.findOne as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 9 });
    const dto = { event, visit_id: '738e15c8-8bd9-4721-91d7-fdd4c65b10d7' };
    await expect(promotionService.recordEvent(1, dto)).resolves.toEqual({ recorded: true });
    await expect(promotionService.recordEvent(1, dto)).resolves.toEqual({ recorded: false });
    expect(promotion.increment).toHaveBeenCalledTimes(1);
    expect(promotion.increment).toHaveBeenCalledWith(`${event === 'cta' ? 'cta' : event}_count`, { by: 1, transaction, silent: true });
    expect(PromotionEvent.create).toHaveBeenCalledTimes(1);
    expect(PromotionEvent.create).toHaveBeenCalledWith({ promotion_id: 1, ...dto }, { transaction });
    expect(Promotion.findByPk).toHaveBeenCalledWith(1, { transaction, lock: 'UPDATE' });
  });
  test.each([
    { is_active: false }, { start_at: new Date('2099-01-01T00:00:00Z') }, { end_at: new Date('2020-01-01T00:00:00Z') },
  ])('does not count inactive or out-of-schedule promotions: %j', async (override) => {
    (Promotion.findByPk as jest.Mock).mockResolvedValue(row(override));
    await expect(promotionService.recordEvent(1, { event: 'open', visit_id: '738e15c8-8bd9-4721-91d7-fdd4c65b10d7' })).rejects.toMatchObject({ statusCode: 404 });
    expect(PromotionEvent.create).not.toHaveBeenCalled();
  });
  test('event storage failure aborts the transaction before changing a counter', async () => {
    const promotion = row();
    (Promotion.findByPk as jest.Mock).mockResolvedValue(promotion);
    (PromotionEvent.findOne as jest.Mock).mockResolvedValue(null);
    (PromotionEvent.create as jest.Mock).mockRejectedValueOnce(new Error('storage failure'));
    await expect(promotionService.recordEvent(1, { event: 'open', visit_id: '738e15c8-8bd9-4721-91d7-fdd4c65b10d7' })).rejects.toThrow('storage failure');
    expect(promotion.increment).not.toHaveBeenCalled();
  });
});
