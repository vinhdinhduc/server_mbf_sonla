import { z } from 'zod';

export const settingGroupEnum = z.enum(['general', 'theme', 'ai', 'analytics']);

export const settingItemSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
}).superRefine((item, context) => {
  if (item.key !== 'ai_chatbot_quick_replies') return;
  try {
    const value = JSON.parse(item.value);
    if (!Array.isArray(value) || value.length < 1 || value.length > 8
      || value.some((question) => typeof question !== 'string' || question.trim().length < 2 || question.trim().length > 100)) throw new Error();
  } catch {
    context.addIssue({ code: 'custom', path: ['value'], message: 'Nhập mảng JSON từ 1–8 câu gợi ý, mỗi câu từ 2–100 ký tự.' });
  }
});

export const updateSettingsSchema = z.object({
  group: settingGroupEnum,
  items: z.array(settingItemSchema).min(1),
});

// Cac khoa bi mat TUYET DOI khong duoc phep ghi vao bang settings (muc 5.17 / muc 17)
export const FORBIDDEN_SETTING_KEYS = [
  'ANTHROPIC_API_KEY',
  'RECAPTCHA_SECRET_KEY',
  'SMTP_USER',
  'SMTP_PASS',
  'JWT_SECRET',
  'DB_PASSWORD',
];

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
