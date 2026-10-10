import { formatMonthShort, formatShort } from '../../lib/format';

/** Round tick values covering [min, max], about `count` of them. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

/** Axis range for the values: from zero when that's meaningful, padded, ending on round ticks. */
export function niceDomain(values: number[], zeroBased: boolean, fixed?: [number, number]): [number, number] {
  if (fixed) return fixed;
  if (!values.length) return [0, 1];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo -= Math.abs(lo) * 0.1 || 1;
    hi += Math.abs(hi) * 0.1 || 1;
  }
  const pad = (hi - lo) * 0.08;
  lo = zeroBased && lo >= 0 ? 0 : lo - pad;
  hi += pad;
  const ticks = niceTicks(lo, hi, 5);
  const step = ticks.length > 1 ? ticks[1]! - ticks[0]! : 1;
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
}

/** Ticks for a time-of-day axis (minutes after midnight): on the hour, every 1, 2 or 3 hours. */
export function clockDomain(values: number[]): { domain: [number, number]; ticks: number[] } {
  if (!values.length) return { domain: [0, 60], ticks: [0, 60] };
  const lo = Math.floor(Math.min(...values) / 60) * 60;
  const hi = Math.ceil(Math.max(...values) / 60) * 60;
  const every = hi - lo <= 360 ? 60 : hi - lo <= 720 ? 120 : 180;
  const start = Math.floor(lo / every) * every;
  const end = Math.ceil(hi / every) * every;
  const ticks: number[] = [];
  for (let t = start; t <= end; t += every) ticks.push(t);
  return { domain: [start, end], ticks };
}

/** Which dates get an x-axis label, and what it says, for `n` days. */
export function dateTicks(dates: string[]): { index: number; label: string }[] {
  const n = dates.length;
  if (n <= 10) return dates.map((d, index) => ({ index, label: formatShort(d) }));
  if (n <= 60) {
    const every = n <= 31 ? 7 : 14;
    return dates.flatMap((d, index) => (index % every === 0 ? [{ index, label: formatShort(d) }] : []));
  }
  const months = n <= 200 ? 1 : n <= 400 ? 2 : n <= 800 ? 3 : 6;
  return dates.flatMap((d, index) => {
    if (!d.endsWith('-01')) return [];
    const month = Number(d.slice(5, 7)) - 1;
    if (month % months !== 0) return [];
    return [{ index, label: month === 0 ? d.slice(0, 4) : formatMonthShort(d) }];
  });
}
