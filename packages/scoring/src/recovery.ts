import { robustBaseline, sigmoid, zScore } from "./stats";

/** Days of history needed before we show any recovery score. */
export const MIN_BASELINE_DAYS = 4;
/** Until this many days, the score is shown but flagged as calibrating. */
export const CALIBRATED_DAYS = 14;
const BASELINE_WINDOW_DAYS = 30;

export interface NightMetrics {
  hrvRmssd: number;
  restingHr: number;
}

export interface RecoveryInput {
  today: NightMetrics;
  /** Previous nights, oldest first. Today must not be included. */
  history: NightMetrics[];
  /** Last night's sleep score (0 to 100), if known. */
  sleepScore?: number;
}

export type RecoveryZone = "green" | "yellow" | "red";

export interface RecoveryResult {
  /** 0 to 100, or null while there isn't enough history. */
  score: number | null;
  zone: RecoveryZone | null;
  calibrating: boolean;
  daysOfHistory: number;
  hrvZ: number | null;
  restingHrZ: number | null;
}

export function recoveryZone(score: number): RecoveryZone {
  if (score >= 67) return "green";
  if (score >= 34) return "yellow";
  return "red";
}

export function computeRecovery(input: RecoveryInput): RecoveryResult {
  const history = input.history.slice(-BASELINE_WINDOW_DAYS);
  const daysOfHistory = history.length;
  if (daysOfHistory < MIN_BASELINE_DAYS) {
    return { score: null, zone: null, calibrating: true, daysOfHistory, hrvZ: null, restingHrZ: null };
  }

  // HRV is log-normally distributed, so compare in log space.
  const hrvBaseline = robustBaseline(history.map((h) => Math.log(h.hrvRmssd)), 0.05)!;
  const rhrBaseline = robustBaseline(history.map((h) => h.restingHr), 1.5)!;
  const hrvZ = zScore(Math.log(input.today.hrvRmssd), hrvBaseline);
  // A lower resting heart rate than usual is good, so flip the sign.
  const restingHrZ = -zScore(input.today.restingHr, rhrBaseline);
  const sleepZ = input.sleepScore === undefined ? 0 : (input.sleepScore - 80) / 15;

  const combined = 0.6 * hrvZ + 0.25 * restingHrZ + 0.15 * sleepZ;
  // The sigmoid squashes the ends, so only a truly unusual night reaches 5% or 95%.
  const score = Math.round(100 * sigmoid(0.3 + combined));

  return {
    score,
    zone: recoveryZone(score),
    calibrating: daysOfHistory < CALIBRATED_DAYS,
    daysOfHistory,
    hrvZ: Math.round(hrvZ * 100) / 100,
    restingHrZ: Math.round(restingHrZ * 100) / 100,
  };
}
