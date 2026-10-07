import path from 'path';
import { applyJobSchema } from '../../src/validators/job.validator';
import { isSafeCvContent, isWithinCvDirectory } from '../../src/utils/cvSecurity';
import { jobController } from '../../src/controllers/job.controller';
import { jobService } from '../../src/services/job.service';
import { promises as fs } from 'fs';
jest.mock('../../src/services/job.service', () => ({ jobService: { apply: jest.fn() } }));
jest.mock('../../src/utils/verifyRecaptcha', () => ({ verifyRecaptcha: jest.fn() }));
const base = { full_name: 'Nguyễn An', phone: '0912 345 678', email: 'AN@example.com', introduction: '', agreed_terms: 'true', website: '', recaptcha_token: 'test' };

test('normalizes phone/email and validates the same boundaries as the client', () => {
  expect(applyJobSchema.parse(base)).toMatchObject({ phone: '0912345678', email: 'an@example.com' });
  expect(applyJobSchema.parse({ ...base, phone: '+84 912 345 678' }).phone).toBe('0912345678');
  for (const body of [{ ...base, full_name: 'A' }, { ...base, phone: '0212345678' }, { ...base, introduction: 'x'.repeat(1001) }, { ...base, agreed_terms: 'false' }, { ...base, website: 'spam' }]) expect(applyJobSchema.safeParse(body).success).toBe(false);
});
test('rejects executable and active PDF content', () => {
  expect(isSafeCvContent(Buffer.from('%PDF-1.7\nHello\n%%EOF'), 'cv.pdf')).toBe(true);
  expect(isSafeCvContent(Buffer.from('MZ executable'), 'cv.pdf')).toBe(false);
  expect(isSafeCvContent(Buffer.from('%PDF-1.7 /OpenAction << /JS (run()) >>'), 'cv.pdf')).toBe(false);
  expect(isSafeCvContent(Buffer.from('PK\x03\x04fake zip'), 'cv.docx')).toBe(false);
});
test('rejects directory escapes and accepts a private UUID file', () => {
  const root = path.resolve('private/cv');
  expect(isWithinCvDirectory(root, path.resolve(root, 'a.pdf'))).toBe(true);
  expect(isWithinCvDirectory(root, path.resolve(root, '../secrets.pdf'))).toBe(false);
  expect(isWithinCvDirectory(root, path.resolve(root, '../../.env'))).toBe(false);
  expect(isWithinCvDirectory(root, root)).toBe(false);
});
test('deletes the new CV when a closed or duplicate application is rejected', async () => {
  const unlink = jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);
  (jobService.apply as jest.Mock).mockRejectedValue(new Error('SQL contains personal data'));
  try {
    await expect(jobController.apply({ body: base, file: { path: '/private/cv/test.pdf' } } as any, {} as any)).rejects.toThrow('Chưa thể nhận hồ sơ');
    expect(unlink).toHaveBeenCalledWith('/private/cv/test.pdf');
  } finally { unlink.mockRestore(); }
});
