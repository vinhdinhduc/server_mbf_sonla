import { env } from '../config/env';
import { AppError } from './AppError';

interface RecaptchaVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

/**
 * Goi https://www.google.com/recaptcha/api/siteverify de verify recaptcha_token
 * TRUOC KHI ghi bat ky du lieu nao vao DB (muc 11). Neu that bai hoac score
 * duoi nguong cau hinh (RECAPTCHA_MIN_SCORE), nem AppError 400.
 */
export async function verifyRecaptcha(token: string): Promise<void> {
  const params = new URLSearchParams({
    secret: env.RECAPTCHA_SECRET_KEY,
    response: token,
  });

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = (await res.json()) as RecaptchaVerifyResponse;

  if (!data.success || (typeof data.score === 'number' && data.score < env.RECAPTCHA_MIN_SCORE)) {
    throw AppError.badRequest('Xac thuc reCAPTCHA that bai, vui long thu lai');
  }
}
