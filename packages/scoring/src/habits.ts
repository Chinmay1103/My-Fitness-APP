import type { DailyScores } from "./daily";
import { round } from "./stats";
import type { HabitEntry } from "./types";

/**
 * What a habit does to you: the next morning's recovery and that night's sleep after days with the
 * habit, compared with days without it, over the last 60 days. Only an association; shown once
 * there are at least 3 days on each side, and called "early" until 6.
 */

export interface HabitImpact {
  kind: string;
  daysWith: number;
  daysWithout: number;
  /** Next-morning recovery after days with it, minus after days without, in points. */
  recoveryDiff: number | null;
  /** That night's sleep score, same comparison. */
  sleepDiff: number | null;
  /** Fewer than 6 days with it: treat as a hint. */
  early: boolean;
}

const MIN_DAYS = 3;
const SOLID_DAYS = 6;
const WINDOW = 60;

export function habitImpact(entries: HabitEntry[], scores: DailyScores[]): HabitImpact[] {
  const recent = scores.slice(-WINDOW - 1);
  const kinds = [...new Set(entries.map((e) => e.kind))];
  return kinds
    .map((kind) => {
      const habitDays = new Set(entries.filter((e) => e.kind === kind).map((e) => e.date));
      const withRec: number[] = [];
      const withoutRec: number[] = [];
      const withSleep: number[] = [];
      const withoutSleep: number[] = [];
      // The habit on day i shows up in day i+1's scores (the night after, the morning after).
      for (let i = 0; i < recent.length - 1; i++) {
        const next = recent[i + 1]!;
        const had = habitDays.has(recent[i]!.date);
        if (next.recovery?.score != null) (had ? withRec : withoutRec).push(next.recovery.score);
        if (next.sleep) (had ? withSleep : withoutSleep).push(next.sleep.score);
      }
      const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
      const diff = (a: number[], b: number[]) => (a.length >= MIN_DAYS && b.length >= MIN_DAYS ? round(mean(a) - mean(b)) : null);
      const daysWith = Math.max(withRec.length, withSleep.length);
      return {
        kind,
        daysWith,
        daysWithout: Math.max(withoutRec.length, withoutSleep.length),
        recoveryDiff: diff(withRec, withoutRec),
        sleepDiff: diff(withSleep, withoutSleep),
        early: daysWith < SOLID_DAYS,
      };
    })
    .sort((a, b) => Math.abs(b.recoveryDiff ?? 0) - Math.abs(a.recoveryDiff ?? 0));
}
