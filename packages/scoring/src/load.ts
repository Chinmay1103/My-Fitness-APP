import type { DailyScores } from "./daily";
import { round } from "./stats";

/**
 * Training load: how hard the last week was (acute, 7-day average of the daily load) against what
 * you're used to (chronic, 28-day average). Uses TRIMP, the raw load behind strain, because strain
 * is squashed onto 0–21 and doesn't add up across days. The ratio says whether you're building
 * fitness, holding steady or doing too much too soon.
 */

export type LoadZone = "fresh" | "steady" | "building" | "overreaching";

export interface LoadDay {
  date: string;
  acute: number;
  chronic: number;
  /** acute / chronic; null until there are 14 days of history. */
  ratio: number | null;
  zone: LoadZone | null;
}

const MIN_DAYS = 14;

export function loadZone(ratio: number): LoadZone {
  if (ratio < 0.8) return "fresh";
  if (ratio <= 1.3) return "steady";
  if (ratio <= 1.5) return "building";
  return "overreaching";
}

export function trainingLoad(scores: DailyScores[]): LoadDay[] {
  return scores.map((s, i) => {
    const avg = (n: number) => {
      const slice = scores.slice(Math.max(0, i - n + 1), i + 1);
      return slice.reduce((sum, d) => sum + d.strain.trimp, 0) / slice.length;
    };
    const acute = avg(7);
    const chronic = avg(28);
    const ratio = i + 1 >= MIN_DAYS && chronic > 0 ? round(acute / chronic, 2) : null;
    return { date: s.date, acute: round(acute, 1), chronic: round(chronic, 1), ratio, zone: ratio === null ? null : loadZone(ratio) };
  });
}
