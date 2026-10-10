import { describe, expect, it } from 'vitest';

import { toCsv } from '../src/lib/csv';
import type { Dataset } from '../src/lib/data';
import { addDays, dateRange, localMinutes, weekStart } from '../src/lib/dates';
import { demoDataset } from '../src/lib/demo';
import { buildRows } from '../src/lib/metrics';
import { presetRange } from '../src/lib/range';
import { fit, mean, pairs, periods, previousRange, rollingMean, summarize, zoneMix } from '../src/lib/stats';
import { clockDomain, niceDomain } from '../src/components/charts/scale';

const demo = demoDataset();

describe('dates', () => {
  it('walks calendar days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dateRange('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  });
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-10-10')).toBe('2026-10-05'); // a Saturday
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(weekStart('2026-10-11')).toBe('2026-10-05'); // Sunday belongs to the week before
  });
  it('reads clock time in the profile time zone', () => {
    // 18:00 UTC is 23:30 in India.
    expect(localMinutes(Date.parse('2026-10-09T18:00:00Z'), 'Asia/Kolkata')).toBe(23 * 60 + 30);
  });
});

describe('rows', () => {
  it('has one row per date, gaps included', () => {
    const data: Dataset = { ...demo, days: demo.days.filter((_, i) => i % 2 === 0) };
    const from = demo.days.at(-30)!.date;
    const to = demo.days.at(-1)!.date;
    const rows = buildRows(data, from, to);
    expect(rows).toHaveLength(30);
    expect(rows.filter((r) => r.day).length).toBe(15);
    expect(rows.filter((r) => !r.day).every((r) => r.values.recovery === null)).toBe(true);
  });
  it('adds up the day’s meals', () => {
    const date = demo.days.at(-1)!.date;
    const data: Dataset = {
      ...demo,
      meals: [
        { id: 'a', date, eatenAt: 0, description: null, calories: 500, proteinG: 30, carbsG: null, fatG: null },
        { id: 'b', date, eatenAt: 0, description: null, calories: 700, proteinG: null, carbsG: null, fatG: null },
      ],
    };
    const [row] = buildRows(data, date, date);
    expect(row!.values.caloriesIn).toBe(1200);
    expect(row!.values.protein).toBe(30);
  });
});

describe('stats', () => {
  it('rolling mean skips gaps and needs enough days', () => {
    expect(rollingMean([1, null, 3, 5], 3, 2)).toEqual([null, null, 2, 4]);
  });
  it('summarize finds the extremes with their dates', () => {
    const rows = buildRows(demo, demo.days.at(-60)!.date, demo.days.at(-1)!.date);
    const s = summarize(rows, 'hrv');
    const hrvs = rows.map((r) => r.values.hrv).filter((v): v is number => v != null);
    expect(s.max!.value).toBe(Math.max(...hrvs));
    expect(s.min!.value).toBe(Math.min(...hrvs));
    expect(s.avg).toBeCloseTo(mean(hrvs)!, 6);
  });
  it('weeks are Monday to Sunday and account for every day', () => {
    const rows = buildRows(demo, '2026-09-01', '2026-09-30');
    const weeks = periods(rows, 'week');
    expect(weeks[0]!.start).toBe('2026-09-01'); // clipped to the range
    expect(weeks[1]!.start).toBe('2026-09-07');
    expect(weeks.reduce((a, w) => a + w.days, 0)).toBe(rows.filter((r) => r.day).length);
    const mix = zoneMix(rows);
    expect(weeks.reduce((a, w) => a + w.green + w.yellow + w.red, 0)).toBe(mix.green + mix.yellow + mix.red);
  });
  it('months split on the 1st', () => {
    const rows = buildRows(demo, '2026-08-15', '2026-10-05');
    expect(periods(rows, 'month').map((p) => [p.start, p.end])).toEqual([
      ['2026-08-15', '2026-08-31'],
      ['2026-09-01', '2026-09-30'],
      ['2026-10-01', '2026-10-05'],
    ]);
  });
  it('previous range is the same length, just before', () => {
    expect(previousRange('2026-10-01', '2026-10-10')).toEqual({ from: '2026-09-21', to: '2026-09-30' });
  });
  it('fit finds a perfect line', () => {
    const f = fit([1, 2, 3, 4, 5].map((x) => ({ x, y: 2 * x + 1 })))!;
    expect(f.r).toBeCloseTo(1);
    expect(f.slope).toBeCloseTo(2);
    expect(f.intercept).toBeCloseTo(1);
    expect(fit([{ x: 1, y: 1 }])).toBeNull();
  });
  it('next-day pairs line up today with tomorrow', () => {
    const rows = buildRows(demo, demo.days.at(-3)!.date, demo.days.at(-1)!.date);
    const p = pairs(rows, 'strain', 'recovery', true);
    expect(p).toHaveLength(2);
    expect(p[0]!.y).toBe(rows[1]!.values.recovery);
  });
});

describe('ranges and axes', () => {
  it('"All time" starts at the first synced day', () => {
    expect(presetRange('all', '2026-10-10', '2026-10-03')).toEqual({ preset: 'all', from: '2026-10-03', to: '2026-10-10' });
    expect(presetRange('30d', '2026-10-10', '2026-10-03').from).toBe('2026-09-11');
  });
  it('axis domains end on round ticks', () => {
    const [lo, hi] = niceDomain([43, 68], false);
    expect(lo).toBeLessThanOrEqual(43);
    expect(hi).toBeGreaterThanOrEqual(68);
    expect(niceDomain([3, 9], true)[0]).toBe(0);
  });
  it('time-of-day axes tick on the hour', () => {
    const c = clockDomain([-50, 470]); // 11:10 PM to 7:50 AM
    expect(c.ticks.every((t) => t % 60 === 0)).toBe(true);
    expect(c.domain[0]).toBeLessThanOrEqual(-50);
    expect(c.domain[1]).toBeGreaterThanOrEqual(470);
  });
});

describe('csv', () => {
  it('quotes commas and quotes, and defuses formulas', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['=1+1', -3]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n\'=1+1,-3');
  });
});

describe('demo data', () => {
  it('covers more than a year, scored by the real math', () => {
    expect(demo.days.length).toBeGreaterThan(365);
    expect(demo.days.filter((d) => d.recovery != null).length).toBeGreaterThan(300);
    expect(demo.workouts.length).toBeGreaterThan(50);
  });
});
