import { robustBaseline, roundToTotal, sigmoid, zScore } from "./stats";

/** Days of history needed before we show any recovery score. */
export const MIN_BASELINE_DAYS = 4;
/** Until this many days, the score is shown but flagged as calibrating. */
export const CALIBRATED_DAYS = 14;
const BASELINE_WINDOW_DAYS = 30;
/** Last night's sleep score is compared with this benchmark, not a personal baseline. */
export const SLEEP_BENCHMARK = 80;
/** A night exactly at your baseline scores this, so factors are shown as points above or below it. */
const OFFSET = 0.3;
const WEIGHTS = { hrv: 0.6, restingHr: 0.25, sleep: 0.15 } as const;
/**
 * With breathing rate known (tonight and on enough past nights), it takes a share from HRV and
 * resting HR. A raised breathing rate during sleep is an early sign of illness or overreaching.
 */
const WEIGHTS_WITH_BREATHING = { hrv: 0.55, restingHr: 0.2, respiratoryRate: 0.1, sleep: 0.15 } as const;

export interface NightMetrics {
  hrvRmssd: number;
  restingHr: number;
  /** Breaths per minute asleep, when the band recorded it. */
  respiratoryRate?: number;
}

export interface RecoveryInput {
  today: NightMetrics;
  /** Previous nights, oldest first. Today must not be included. */
  history: NightMetrics[];
  /** Last night's sleep score (0 to 100), if known. */
  sleepScore?: number;
}

export type RecoveryZone = "green" | "yellow" | "red";

export interface RecoveryFactor {
  key: "hrv" | "restingHr" | "respiratoryRate" | "sleep";
  /** Last night's value: HRV in ms, resting HR in bpm, breathing in breaths/min, sleep score in %. */
  today: number;
  /** What it was compared with: your 30-day median, or the sleep benchmark. */
  baseline: number;
  /** Points this factor added to (or took off) the typical score. */
  points: number;
}

export interface RecoveryBreakdown {
  /** The score you'd get on a night exactly at your baseline. */
  typical: number;
  /** `typical` plus every factor's points equals the score. */
  factors: RecoveryFactor[];
}

export interface RecoveryResult {
  /** 0 to 100, or null while there isn't enough history. */
  score: number | null;
  zone: RecoveryZone | null;
  calibrating: boolean;
  daysOfHistory: number;
  hrvZ: number | null;
  restingHrZ: number | null;
  breakdown: RecoveryBreakdown | null;
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
    return { score: null, zone: null, calibrating: true, daysOfHistory, hrvZ: null, restingHrZ: null, breakdown: null };
  }

  // HRV is log-normally distributed, so compare in log space.
  const hrvBaseline = robustBaseline(history.map((h) => Math.log(h.hrvRmssd)), 0.05)!;
  const rhrBaseline = robustBaseline(history.map((h) => h.restingHr), 1.5)!;
  const hrvZ = zScore(Math.log(input.today.hrvRmssd), hrvBaseline);
  // A lower resting heart rate than usual is good, so flip the sign.
  const restingHrZ = -zScore(input.today.restingHr, rhrBaseline);
  const sleepZ = input.sleepScore === undefined ? 0 : (input.sleepScore - SLEEP_BENCHMARK) / 15;
  const breathingHistory = history.flatMap((h) => (h.respiratoryRate !== undefined ? [h.respiratoryRate] : []));
  const breathingBaseline =
    input.today.respiratoryRate !== undefined && breathingHistory.length >= MIN_BASELINE_DAYS
      ? robustBaseline(breathingHistory, 0.5)
      : null;
  // Faster breathing than usual is bad, so flip the sign.
  const breathingZ = breathingBaseline ? -zScore(input.today.respiratoryRate!, breathingBaseline) : 0;
  const weights = breathingBaseline ? WEIGHTS_WITH_BREATHING : { ...WEIGHTS, respiratoryRate: 0 };

  const contributions = {
    hrv: weights.hrv * hrvZ,
    restingHr: weights.restingHr * restingHrZ,
    respiratoryRate: weights.respiratoryRate * breathingZ,
    sleep: weights.sleep * sleepZ,
  };
  const combined = contributions.hrv + contributions.restingHr + contributions.respiratoryRate + contributions.sleep;
  // The sigmoid squashes the ends, so only a truly unusual night reaches 5% or 95%.
  const exact = 100 * sigmoid(OFFSET + combined);
  const score = Math.round(exact);

  // Split the distance from a typical night between the factors, in proportion to their pull.
  const typicalExact = 100 * sigmoid(OFFSET);
  const typical = Math.round(typicalExact);
  const slope =
    Math.abs(combined) > 1e-9
      ? (exact - typicalExact) / combined
      : 100 * sigmoid(OFFSET) * (1 - sigmoid(OFFSET));
  const factors: Omit<RecoveryFactor, "points">[] = [
    { key: "hrv", today: input.today.hrvRmssd, baseline: Math.round(Math.exp(hrvBaseline.center)) },
    { key: "restingHr", today: input.today.restingHr, baseline: Math.round(rhrBaseline.center) },
  ];
  if (breathingBaseline) {
    factors.push({
      key: "respiratoryRate",
      today: Math.round(input.today.respiratoryRate! * 10) / 10,
      baseline: Math.round(breathingBaseline.center * 10) / 10,
    });
  }
  if (input.sleepScore !== undefined) {
    factors.push({ key: "sleep", today: input.sleepScore, baseline: SLEEP_BENCHMARK });
  }
  const points = roundToTotal(
    factors.map((f) => contributions[f.key] * slope),
    score - typical,
  );

  return {
    score,
    zone: recoveryZone(score),
    calibrating: daysOfHistory < CALIBRATED_DAYS,
    daysOfHistory,
    hrvZ: Math.round(hrvZ * 100) / 100,
    restingHrZ: Math.round(restingHrZ * 100) / 100,
    breakdown: { typical, factors: factors.map((f, i) => ({ ...f, points: points[i]! })) },
  };
}
