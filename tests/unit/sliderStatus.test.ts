import { sliderEffectiveStatus } from '../../src/utils/sliderStatus';

describe('TC-24: banner validity', () => {
  it('expires after its end date without changing the stored status', () => {
    expect(sliderEffectiveStatus({ status: 'active', start_date: new Date('2026-08-25'), end_date: new Date('2026-09-03T23:59:59+07:00') }, new Date('2026-09-04T00:00:00+07:00'))).toBe('expired');
  });
});
