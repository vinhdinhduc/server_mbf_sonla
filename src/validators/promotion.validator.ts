import { z } from 'zod';

const origin = 'https://promotion.invalid';
export function isSafePromotionUrl(value: string) {
  if (/[\\\u0000-\u0020\u007f]/.test(value)) return false;
  if (!value.startsWith('/') && !/^https?:\/\//i.test(value)) return false;
  if (value.startsWith('//')) return false;
  try {
    const url = new URL(value, origin);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export function normalizePromotionPath(value: string) {
  return new URL(value, origin).pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
}

const nullableText = (max: number) => z.string().trim().max(max).nullable().default(null);
const safeUrl = z.string().trim().max(2000).refine(isSafePromotionUrl, 'Đường dẫn phải là HTTP(S) hoặc bắt đầu bằng /').nullable().default(null);
const isoDate = z.string().datetime({ offset: true, message: 'Ngày giờ phải là ISO có múi giờ' }).transform((value) => new Date(value)).nullable().default(null);
const pathSchema = z.string().trim().max(2000).refine(
  (value) => value.startsWith('/') && isSafePromotionUrl(value) && !/[?#]/.test(value),
  'Trang áp dụng phải là đường dẫn /... và không có query hoặc #',
).transform(normalizePromotionPath);

const promotionFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên chương trình').max(160),
  title: z.string().trim().min(1, 'Nhập tiêu đề').max(255),
  content: z.string().trim().min(1, 'Nhập nội dung khuyến mại').max(10000),
  image_url: safeUrl,
  coupon_code: nullableText(100),
  cta_text: nullableText(100),
  cta_link: safeUrl,
  effect_type: z.enum(['bounce', 'shake', 'popup']).default('bounce'),
  position: z.enum(['center', 'bottom_right', 'bottom_left']).default('bottom_right'),
  trigger_type: z.enum(['immediate', 'delay', 'scroll']).default('delay'),
  trigger_value: z.number().int().min(0).max(3600).default(3),
  target_pages: z.array(pathSchema).max(100).transform((pages) => [...new Set(pages)]).default([]),
  frequency: z.enum(['visit', 'daily', 'once']).default('daily'),
  device: z.enum(['desktop', 'mobile', 'all']).default('all'),
  start_at: isoDate,
  end_at: isoDate,
  is_active: z.boolean().default(false),
}).strict();

export function validatePromotionBounds(
  values: {
    trigger_type: string; trigger_value: number; start_at: Date | null; end_at: Date | null;
    cta_text: string | null; cta_link: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (values.start_at && values.end_at && values.start_at >= values.end_at) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['end_at'], message: 'Ngày kết thúc phải sau ngày bắt đầu' });
  }
  if (values.trigger_type === 'scroll' && values.trigger_value > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['trigger_value'], message: 'Tỷ lệ cuộn trang phải từ 0 đến 100%' });
  }
  if (Boolean(values.cta_link) !== Boolean(values.cta_text)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [values.cta_link ? 'cta_text' : 'cta_link'],
      message: 'Nút kêu gọi hành động cần cả nội dung và đường dẫn',
    });
  }
}

export const createPromotionSchema = promotionFieldsSchema.superRefine(validatePromotionBounds);
export const updatePromotionSchema = promotionFieldsSchema.partial();
// Used after merging partial changes with the stored record so changing only one bound cannot bypass validation.
export const promotionBoundsSchema = z.object({
  trigger_type: z.enum(['immediate', 'delay', 'scroll']),
  trigger_value: z.number().int().min(0).max(3600),
  start_at: z.date().nullable(),
  end_at: z.date().nullable(),
  cta_text: z.string().nullable(),
  cta_link: z.string().nullable(),
}).superRefine(validatePromotionBounds);
export const promotionIdSchema = z.coerce.number().int().positive().max(2147483647);
export const publicPromotionQuerySchema = z.object({
  path: z.string().max(2000).refine((value) => value.startsWith('/') && isSafePromotionUrl(value), 'Đường dẫn trang không hợp lệ').transform(normalizePromotionPath).default('/'),
  device: z.enum(['desktop', 'mobile']).default('desktop'),
});
export const promotionEventSchema = z.object({
  event: z.enum(['impression', 'open', 'cta']),
  visit_id: z.string().uuid().transform((value) => value.toLowerCase()),
}).strict();
export type CreatePromotionDto = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionDto = z.infer<typeof updatePromotionSchema>;
export type PublicPromotionQuery = z.infer<typeof publicPromotionQuerySchema>;
export type PromotionEventDto = z.infer<typeof promotionEventSchema>;
