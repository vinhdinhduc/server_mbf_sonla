/** Date-only UTC iteration avoids daylight saving gaps and always includes empty dates. */
export function dateKeys(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86400000) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }
  return dates;
}

export function fillDateSeries(dates: string[], rows: Array<{ date: string; value: number | string }>) {
  const totals = new Map<string, number>();
  rows.forEach((row) => totals.set(String(row.date), (totals.get(String(row.date)) || 0) + Number(row.value || 0)));
  return dates.map((date) => ({ date, value: totals.get(date) || 0 }));
}
