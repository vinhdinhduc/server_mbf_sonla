import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_BASE_URL: z.string().url(),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET phai co it nhat 16 ky tu'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  APP_SECRET_KEY: z.string().min(32).default('change-this-app-secret-key-before-production-32'),

  ALLOWED_ORIGINS: z.string().min(1),

  SEED_ADMIN_USERNAME: z.string().default('admin'),
  SEED_ADMIN_PASSWORD: z.string().min(6, 'SEED_ADMIN_PASSWORD phai co it nhat 6 ky tu'),

  RECAPTCHA_SECRET_KEY: z.string().min(1),
  RECAPTCHA_SITE_KEY: z.string().min(1),
  RECAPTCHA_MIN_SCORE: z.coerce.number().default(0.5),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().min(1),

  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default('claude-haiku-4-5'),

  UPLOAD_DIR: z.string().default('src/uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(5),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('❌ Bien moi truong khong hop le:');
    // eslint-disable-next-line no-console
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export const ALLOWED_ORIGINS_LIST = env.ALLOWED_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
