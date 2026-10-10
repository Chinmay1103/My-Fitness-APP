import { toMs } from './dates';

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', ...opts });
const longDay = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const shortDay = fmt({ day: 'numeric', month: 'short' });
const monthYear = fmt({ month: 'short', year: 'numeric' });
const monthOnly = fmt({ month: 'short' });

/** "Fri, 10 Oct 2026" */
export const formatDate = (date: string) => longDay.format(toMs(date));
/** "10 Oct" */
export const formatShort = (date: string) => shortDay.format(toMs(date));
/** "Oct 2026" */
export const formatMonth = (date: string) => monthYear.format(toMs(date));
/** "Oct" */
export const formatMonthShort = (date: string) => monthOnly.format(toMs(date));

/** 452 -> "7h 32m" */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

/** Minutes after midnight (may be negative or past 1440) -> "11:40 PM". */
export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${suffix}`;
}

/** 12900 -> "12,900", 1.25 with 1 decimal -> "1.3". */
export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Signed change: "+4", "−0.6". */
export function formatDelta(n: number, decimals = 0): string {
  const s = formatNumber(Math.abs(n), decimals);
  if (Number(s.replace(/,/g, '')) === 0) return '±0';
  return `${n > 0 ? '+' : '−'}${s}`;
}
