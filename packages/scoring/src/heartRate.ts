import { round } from "./stats";
import type { DayData, HeartRateSample } from "./types";

const MINUTE = 60_000;

/** A whole calendar day of heart rate, the night after midnight included, oldest first. */
export function daySamples(day: DayData | undefined): HeartRateSample[] {
  if (!day) return [];
  return [...(day.sleepHeartRate ?? []), ...day.heartRate].sort((a, b) => a.time - b.time);
}

/** One day's heart rate in a few numbers: what the app's card shows and what the coach gets. */
export interface HeartRateSummary {
  low: number;
  /** Average over the minutes that have readings, so dense workout sampling doesn't pull it up. */
  avg: number;
  high: number;
  latest: HeartRateSample;
  /** Average per local hour, 0 = midnight to 1 AM; null where the band recorded nothing. */
  hourly: (number | null)[];
  /** Minutes with at least one reading: how much of the day the band actually saw. */
  minutesCovered: number;
}

export function summarizeHeartRate(samples: HeartRateSample[]): HeartRateSummary | null {
  if (samples.length === 0) return null;

  // Average within each minute first, then over minutes.
  const minutes = new Map<number, { sum: number; count: number }>();
  let low = Infinity;
  let high = -Infinity;
  let latest = samples[0]!;
  for (const s of samples) {
    low = Math.min(low, s.bpm);
    high = Math.max(high, s.bpm);
    if (s.time > latest.time) latest = s;
    const key = Math.floor(s.time / MINUTE);
    const m = minutes.get(key) ?? { sum: 0, count: 0 };
    m.sum += s.bpm;
    m.count += 1;
    minutes.set(key, m);
  }

  const hours = Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }));
  let total = 0;
  for (const [key, m] of minutes) {
    const bpm = m.sum / m.count;
    total += bpm;
    const hour = hours[new Date(key * MINUTE).getHours()]!;
    hour.sum += bpm;
    hour.count += 1;
  }

  return {
    low: Math.round(low),
    avg: round(total / minutes.size),
    high: Math.round(high),
    latest,
    hourly: hours.map((h) => (h.count > 0 ? round(h.sum / h.count) : null)),
    minutesCovered: minutes.size,
  };
}
