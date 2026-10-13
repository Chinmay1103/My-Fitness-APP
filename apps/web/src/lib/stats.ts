import { nightShortfall, type DailyScores } from '@fitness/scoring';

import type { Dataset } from './data';
import { addDays, weekStart } from './dates';
import type { MetricKey, Row } from './metrics';

/** Pure number crunching for the reports. Display only: none of this changes a score. */

export function mean(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function stdDev(values: number[]): number | null {
  const m = mean(values);
  if (m == null || values.length < 2) return null;
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}

/**
 * Average of the last `window` days at each point, skipping missing days. Null where fewer than
 * `minCount` of them have a value, so a gap in the data stays a gap in the line.
 */
export function rollingMean(values: (number | null)[], window = 7, minCount = 3): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v != null);
    return slice.length >= minCount ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
  });
}

export interface Summary {
  avg: number | null;
  count: number;
  min: { date: string; value: number } | null;
  max: { date: string; value: number } | null;
}

export function summarize(rows: Row[], key: MetricKey): Summary {
  const points = rows.flatMap((r) => (r.values[key] != null ? [{ date: r.date, value: r.values[key]! }] : []));
  let min: Summary['min'] = null;
  let max: Summary['max'] = null;
  for (const p of points) {
    if (!min || p.value < min.value) min = p;
    if (!max || p.value > max.value) max = p;
  }
  return { avg: mean(points.map((p) => p.value)), count: points.length, min, max };
}

export function zoneMix(rows: Row[]) {
  const mix = { green: 0, yellow: 0, red: 0 };
  for (const r of rows) if (r.day?.zone) mix[r.day.zone]++;
  return mix;
}

export type PeriodUnit = 'week' | 'month';

export interface PeriodRow {
  /** First and last date of the period (clipped to the range). */
  start: string;
  end: string;
  /** Days with synced data. */
  days: number;
  averages: Partial<Record<MetricKey, number | null>>;
  green: number;
  yellow: number;
  red: number;
  /** Minutes slept short of need, summed (extra sleep doesn't cancel it out). */
  sleepDebt: number;
  workouts: number;
  /** Total Active Zone Minutes. */
  zoneMinutes: number;
}

const PERIOD_KEYS: MetricKey[] = ['recovery', 'strain', 'sleepScore', 'asleep', 'hrv', 'restingHr', 'steps', 'caloriesIn', 'protein', 'weight'];

function periodKey(date: string, unit: PeriodUnit): string {
  return unit === 'week' ? weekStart(date) : `${date.slice(0, 7)}-01`;
}

/** The range cut into calendar weeks (Monday to Sunday) or months, newest last. */
export function periods(rows: Row[], unit: PeriodUnit): PeriodRow[] {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = periodKey(r.date, unit);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.values()].map((g) => {
    const averages: PeriodRow['averages'] = {};
    for (const key of PERIOD_KEYS) averages[key] = mean(g.map((r) => r.values[key]));
    const mix = zoneMix(g);
    return {
      start: g[0]!.date,
      end: g.at(-1)!.date,
      days: g.filter((r) => r.day).length,
      averages,
      ...mix,
      sleepDebt: Math.round(g.reduce((sum, r) => sum + (r.day ? nightShortfall(r.day.scores) : 0), 0)),
      workouts: g.reduce((sum, r) => sum + r.workouts, 0),
      zoneMinutes: g.reduce((sum, r) => sum + (r.day?.zoneMinutes ?? 0), 0),
    };
  });
}

/** The same number of days just before `from`, to compare a range with. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const length = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return { from: addDays(from, -length), to: addDays(from, -1) };
}

export interface Fit {
  r: number;
  slope: number;
  intercept: number;
  n: number;
}

/** Pearson correlation and a least-squares line. Null with fewer than 5 pairs or no spread. */
export function fit(points: { x: number; y: number }[]): Fit | null {
  const n = points.length;
  if (n < 5) return null;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  if (sxx === 0 || syy === 0) return null;
  const slope = sxy / sxx;
  return { r: sxy / Math.sqrt(sxx * syy), slope, intercept: my - slope * mx, n };
}

/** How strong a correlation is, in words. */
export function describeR(r: number): string {
  const a = Math.abs(r);
  if (a < 0.1) return 'no link';
  if (a < 0.3) return 'a weak link';
  if (a < 0.5) return 'a moderate link';
  return 'a strong link';
}

/** Pairs a day's `x` with the same day's `y`, or the next day's when `nextDay` (e.g. strain -> next morning's recovery). */
export function pairs(rows: Row[], x: MetricKey, y: MetricKey, nextDay: boolean): { date: string; x: number; y: number }[] {
  const out: { date: string; x: number; y: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const xv = rows[i]!.values[x];
    const yRow = nextDay ? rows[i + 1] : rows[i];
    const yv = yRow?.values[y];
    if (xv != null && yv != null) out.push({ date: rows[i]!.date, x: xv, y: yv });
  }
  return out;
}

/** A stand-in for a day the phone never synced, so scoring helpers that walk day by day stay aligned. */
function emptyScores(date: string): DailyScores {
  return {
    date,
    strain: { strain: 0, trimp: 0, zoneMinutes: [0, 0, 0, 0, 0], activities: [], everydayStrain: 0 },
    sleep: null,
    sleepNeed: null,
    recovery: null,
  };
}

/** DailyScores for every row, missing days filled with empty ones. */
export function denseScores(rows: Row[]): DailyScores[] {
  return rows.map((r) => r.day?.scores ?? emptyScores(r.date));
}

/** Habits from the data set with dates inside the rows. */
export function habitsIn(data: Dataset, rows: Row[]) {
  const from = rows[0]?.date ?? '';
  const to = rows.at(-1)?.date ?? '';
  return data.habits.filter((h) => h.date >= from && h.date <= to).map((h) => ({ kind: h.kind, date: h.date, amount: h.amount ?? undefined }));
}
