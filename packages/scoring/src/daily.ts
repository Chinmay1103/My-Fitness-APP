import { computeRecovery, type NightMetrics, type RecoveryResult } from "./recovery";
import { computeSleepScore, sleepNeedMinutes, type SleepScoreResult } from "./sleep";
import { median } from "./stats";
import { computeStrain, type StrainResult } from "./strain";
import type { DayData, UserProfile } from "./types";

const FALLBACK_RESTING_HR = 60;

export interface DailyScores {
  date: string;
  strain: StrainResult;
  sleep: SleepScoreResult | null;
  recovery: RecoveryResult | null;
}

/** Scores every day in order. `days` must be sorted oldest first. */
export function computeDailyScores(days: DayData[], profile: UserProfile): DailyScores[] {
  const results: DailyScores[] = [];
  const nights: NightMetrics[] = [];
  const shortfalls: number[] = [];
  const priorStarts: number[] = [];

  for (const day of days) {
    const restingHr =
      day.restingHr ??
      (nights.length > 0 ? median(nights.map((n) => n.restingHr)) : FALLBACK_RESTING_HR);
    const strain = computeStrain(day.heartRate, restingHr, profile);

    let sleep: SleepScoreResult | null = null;
    if (day.sleep) {
      const need = sleepNeedMinutes({
        baseNeedMinutes: profile.baseSleepNeedMinutes,
        priorDayStrain: results.at(-1)?.strain.strain,
        recentShortfalls: shortfalls.slice(-3),
      });
      sleep = computeSleepScore(day.sleep, need, priorStarts);
      // Debt is measured against the base need, or it would feed on itself night after night.
      const baseNeed = sleepNeedMinutes({ baseNeedMinutes: profile.baseSleepNeedMinutes });
      shortfalls.push(baseNeed - sleep.asleepMinutes);
      priorStarts.push(day.sleep.start);
    }

    let recovery: RecoveryResult | null = null;
    if (day.hrvRmssd !== undefined && day.restingHr !== undefined) {
      const today = { hrvRmssd: day.hrvRmssd, restingHr: day.restingHr };
      recovery = computeRecovery({ today, history: nights, sleepScore: sleep?.score });
      nights.push(today);
    }

    results.push({ date: day.date, strain, sleep, recovery });
  }

  return results;
}
