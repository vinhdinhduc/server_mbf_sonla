import { dateKeys, fillDateSeries } from '../../src/utils/dashboardDates';

describe('TC-38: dashboard dates', () => {
  it('fills missing days with zero', () => {
    const dates = dateKeys('2026-09-01', '2026-09-03');
    expect(fillDateSeries(dates, [{ date: '2026-09-01', value: 2 }, { date: '2026-09-03', value: 1 }])).toEqual([
      { date: '2026-09-01', value: 2 },
      { date: '2026-09-02', value: 0 },
      { date: '2026-09-03', value: 1 },
    ]);
  });
});
