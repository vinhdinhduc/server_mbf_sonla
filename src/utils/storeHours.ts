export interface OpeningSlot {
  days: number[];
  open: string;
  close: string;
}

export function parseOpeningSlots(value: unknown): OpeningSlot[] | null {
  if (value === null || value === undefined) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return null;
    if (
      !parsed.every(
        (slot) =>
          Array.isArray(slot?.days) &&
          typeof slot.open === 'string' &&
          typeof slot.close === 'string',
      )
    )
      return null;
    return parsed as OpeningSlot[];
  } catch {
    return null;
  }
}

/** ISO weekday 1=Monday, 7=Sunday; timestamps are stored UTC. */
export function isStoreOpenNow(slots: OpeningSlot[], instant: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const day = (
    { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>
  )[read('weekday')];
  const time = `${read('hour')}:${read('minute')}`;
  return slots.some((slot) => slot.days.includes(day) && slot.open <= time && time < slot.close);
}
