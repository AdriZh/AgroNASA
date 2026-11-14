const DAY = 86400000;

export function parseISO(s: string): number {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
export function toISO(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number): string {
  return toISO(parseISO(iso) + n * DAY);
}
export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b) - parseISO(a)) / DAY);
}
export function dayIndex(startISO: string, iso: string): number {
  return diffDays(startISO, iso);
}
export function doy(iso: string): number {
  const y = Number(iso.slice(0, 4));
  return diffDays(`${y}-01-01`, iso) + 1;
}
export function fromDoy(year: number, d: number): string {
  return addDays(`${year}-01-01`, Math.round(d) - 1);
}
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function fmtDayMonth(iso?: string | null): string {
  if (!iso) return '—';
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
export function todayISO(): string {
  return toISO(Date.now());
}
