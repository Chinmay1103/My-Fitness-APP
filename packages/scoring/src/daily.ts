import { computeRecovery, type NightMetrics, type RecoveryResult } from "./recovery";
import { computeSleepScore, sleepNeed, sleepNeedMinutes, type SleepNeed, type SleepScoreResult } from "./sleep";
import { median } from "./stats";
import { computeStrain, type StrainResult } from "./strain";
import type { DayData, UserProfile } from "./types";

const FALLBACK_RESTING_HR = 60;

export interface DailyScores {
  date: string;
  strain: StrainResult;
  sleep: SleepScoreResult | null;
  /** How last night's sleep need was built up. */
  sleepNeed: SleepNeed | null;
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
    const strain = computeStrain(day.heartRate, restingHr, profile, day.workouts);

    let sleep: SleepScoreResult | null = null;
    let need: SleepNeed | null = null;
    if (day.sleep) {
      need = sleepNeed({
        baseNeedMinutes: profile.baseSleepNeedMinutes,
        priorDayStrain: results.at(-1)?.strain.strain,
        recentShortfalls: shortfalls.slice(-3),
      });
      sleep = computeSleepScore(day.sleep, need.total, priorStarts);
      // Debt is measured against the base need, or it would feed on itself night after night.
      const baseNeed = sleepNeedMinutes({ baseNeedMinutes: profile.baseSleepNeedMinutes });
      shortfalls.push(baseNeed - sleep.asleepMinutes);
      priorStarts.push(day.sleep.start);
    }

    let recovery: RecoveryResult | null = null;
    if (day.hrvRmssd !== undefined && day.restingHr !== undefined) {
      const today: NightMetrics = { hrvRmssd: day.hrvRmssd, restingHr: day.restingHr };
      if (day.respiratoryRate !== undefined) today.respiratoryRate = day.respiratoryRate;
      recovery = computeRecovery({ today, history: nights, sleepScore: sleep?.score });
      nights.push(today);
    }

    results.push({ date: day.date, strain, sleep, sleepNeed: need, recovery });
  }

  return results;
}
