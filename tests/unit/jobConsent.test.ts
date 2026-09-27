import { promises as fs } from 'fs';
import { jobController } from '../../src/controllers/job.controller';
import { jobService } from '../../src/services/job.service';

jest.mock('../../src/services/job.service', () => ({ jobService: { apply: jest.fn() } }));
jest.mock('../../src/utils/verifyRecaptcha', () => ({ verifyRecaptcha: jest.fn() }));

it('rejects missing consent and removes the uploaded CV before storing an application', async () => {
  const unlink = jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);
  try {
    await expect(jobController.apply({
      body: { full_name: 'A', phone: '0912345678', email: 'a@example.com', recaptcha_token: 'test' },
      file: { path: '/private/test-cv.pdf' },
    } as any, {} as any)).rejects.toThrow();
    expect(unlink).toHaveBeenCalledWith('/private/test-cv.pdf');
    expect(jobService.apply).not.toHaveBeenCalled();
  } finally { unlink.mockRestore(); }
});
