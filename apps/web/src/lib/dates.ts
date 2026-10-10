/** Calendar dates as YYYY-MM-DD strings, handled at noon UTC so no time zone can shift them. */

const DAY = 86_400_000;

export function toMs(date: string): number {
  return Date.parse(`${date}T12:00:00Z`);
}

export function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  return fromMs(toMs(date) + n * DAY);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / DAY);
}

/** Every date from `from` to `to`, both included. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 0 = Monday ... 6 = Sunday. */
export function weekday(date: string): number {
  return (new Date(toMs(date)).getUTCDay() + 6) % 7;
}

/** The Monday of `date`'s week. */
export function weekStart(date: string): string {
  return addDays(date, -weekday(date));
}

/** The local calendar date of an instant in `timeZone` (the user's, from their profile). */
export function localDate(ms: number, timeZone?: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
}

/** Minutes after local midnight of an instant in `timeZone`. */
export function localMinutes(ms: number, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ms);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

export function today(timeZone?: string): string {
  return localDate(Date.now(), timeZone);
}
