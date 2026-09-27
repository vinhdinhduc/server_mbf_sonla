import { z } from 'zod';
export const TERMS_VERSION = 'v1.0';
export const agreedTermsSchema = z.literal(true, {
  errorMap: () => ({ message: 'Vui lòng đồng ý Điều khoản sử dụng và Chính sách bảo mật' }),
});
export const consentAudit = () => ({
  agreed_terms_at: new Date(),
  agreed_terms_version: TERMS_VERSION,
});
