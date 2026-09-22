export function sliderEffectiveStatus(item: { status: string; start_date: Date | null; end_date: Date | null }, now = new Date()) {
  if (item.status !== 'active') return 'hidden';
  if (item.start_date && new Date(item.start_date) > now) return 'scheduled';
  if (item.end_date && new Date(item.end_date) < now) return 'expired';
  return 'active';
}
