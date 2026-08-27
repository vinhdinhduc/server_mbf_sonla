import { z } from 'zod';

export const settingGroupEnum = z.enum(['general', 'theme', 'ai', 'analytics']);

export const settingItemSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
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
