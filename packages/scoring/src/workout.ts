import { clamp, round, roundToTotal } from "./stats";
import { estimateMaxHr, SESSION_RPE_TO_TRIMP, strainFromTrimp, ZONE_BOUNDS } from "./strain";
import type { HeartRateSample, LoggedWorkout, Sex, UserProfile } from "./types";

/**
 * One logged workout on its own: how hard the heart worked during exactly its start-to-end time
 * (zones, TRIMP, a 0-21 strain for the workout alone) and the calories it burned. Both come with a
 * breakdown that adds up exactly to the number, like the daily scores. Shown, never scored: the
 * day's strain still comes from `computeStrain`.
 */

const MAX_GAP_MINUTES = 5;
/** Below 30% of heart-rate reserve adds no strain (same rule as the day's strain). */
const MIN_EFFORT_FRACTION = ZONE_BOUNDS[0];
/** 1 MET: what a resting body burns, about 1 kcal per kg per hour. */
const REST_KCAL_PER_KG_MINUTE = 1 / 60;
/** Used when there's no weigh-in yet. */
export const DEFAULT_WEIGHT_KG = 70;
export const DEFAULT_AGE = 30;

/**
 * METs for minutes the band didn't see (band off, or a gap in heart rate), from the Compendium of
 * Physical Activities: typical values for each kind of workout at a moderate pace.
 */
export const WORKOUT_METS: Record<string, number> = {
  strength: 5,
  run: 9,
  cycle: 7.5,
  walk: 3.5,
  sport: 7,
  class: 5,
  other: 4.5,
};

/** Whoop's words for a strain level, used for the day and for a single workout. */
export function strainLevel(strain: number): "Light" | "Moderate" | "Strenuous" | "All out" {
  if (strain < 10) return "Light";
  if (strain < 14) return "Moderate";
  if (strain < 18) return "Strenuous";
  return "All out";
}

/**
 * Energy burned per minute at a heart rate, kcal (Keytel et al. 2005, the formula most heart-rate
 * watches start from). Without a known sex, the average of the two equations.
 */
export function keytelKcalPerMinute(bpm: number, weightKg: number, age: number, sex?: Sex): number {
  const male = (-55.0969 + 0.6309 * bpm + 0.1988 * weightKg + 0.2017 * age) / 4.184;
  const female = (-20.4022 + 0.4472 * bpm - 0.1263 * weightKg + 0.074 * age) / 4.184;
  return sex === "male" ? male : sex === "female" ? female : (male + female) / 2;
}

/** Zone index for the breakdowns: 0 = below zone 1 (easy movement), 1-5 = zones 1-5. */
function zoneOf(fraction: number): number {
  let zone = 0;
  while (zone < ZONE_BOUNDS.length && fraction >= ZONE_BOUNDS[zone]!) zone++;
  return zone;
}

export interface WorkoutAnalysis {
  /** Logged length, start to end. */
  minutes: number;
  /** Minutes of it the band has heart rate for. */
  heartRateMinutes: number;
  avgBpm: number | null;
  peakBpm: number | null;
  /** Average share of heart-rate reserve used, 0-1: 0 = resting, 1 = flat out. */
  avgReserve: number | null;
  /** Minutes below zone 1, then zones 1-5. */
  zoneMinutes: [number, number, number, number, number, number];
  /** Heart-rate training load (Banister TRIMP) during the workout. */
  trimp: number;
  /** Load the effort rating adds on top, where it says the workout was harder than heart rate showed. */
  effortTrimp: number;
  /** Strain of this workout alone, 0-21 (higher than its share of the day: strain is on a curve). */
  strain: number;
  /** How the strain was made: zones 1-5, then the effort-rating top-up. Adds up to `strain`. */
  strainParts: { zones: [number, number, number, number, number]; effort: number };
  /** The 1-10 effort rating heart rate alone matches (same scale as the rating you give the coach). */
  heartRateEffort: number | null;
  calories: WorkoutCalories;
}

export interface WorkoutCalories {
  total: number;
  /** Burned above resting: what the workout itself cost. `total` minus `resting`. */
  active: number;
  /** What your body would have burned sitting still for the same time. */
  resting: number;
  /** Extra above resting by zone (below zone 1, then zones 1-5) and for minutes without heart rate. Resting plus these equals `total`. */
  extra: { zones: [number, number, number, number, number, number]; noHeartRate: number };
  /** What the estimate used, and which of it was a default rather than yours. */
  basis: { weightKg: number; age: number; sex?: Sex; weightKnown: boolean; ageKnown: boolean; met: number };
}

export function analyzeWorkout(
  workout: LoggedWorkout,
  samples: HeartRateSample[],
  restingHr: number,
  profile: UserProfile,
): WorkoutAnalysis {
  const maxHr = estimateMaxHr(profile);
  const reserve = Math.max(maxHr - restingHr, 1);
  const weightKg = profile.weightKg ?? DEFAULT_WEIGHT_KG;
  const age = profile.age || DEFAULT_AGE;
  const restPerMinute = weightKg * REST_KCAL_PER_KG_MINUTE;
  const minutes = Math.max((workout.end - workout.start) / 60_000, 0);
  // Below zone 1, scale from resting to what the formula gives at the edge of zone 1: Keytel
  // overestimates near resting heart rate, and this keeps the curve smooth.
  const edgeKcal = Math.max(keytelKcalPerMinute(restingHr + MIN_EFFORT_FRACTION * reserve, weightKg, age, profile.sex), restPerMinute);
  const kcalPerMinute = (bpm: number, fraction: number) =>
    fraction >= MIN_EFFORT_FRACTION
      ? Math.max(keytelKcalPerMinute(bpm, weightKg, age, profile.sex), restPerMinute)
      : restPerMinute + (edgeKcal - restPerMinute) * clamp(fraction / MIN_EFFORT_FRACTION, 0, 1);

  const sorted = [...samples].sort((a, b) => a.time - b.time);
  const zoneMinutes = [0, 0, 0, 0, 0, 0];
  const zoneTrimp = [0, 0, 0, 0, 0];
  const zoneKcal = [0, 0, 0, 0, 0, 0];
  let covered = 0;
  let bpmMinutes = 0;
  let reserveMinutes = 0;
  let peak = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const step = Math.min(sorted[i]!.time - prev.time, MAX_GAP_MINUTES * 60_000);
    const from = Math.max(prev.time, workout.start);
    const to = Math.min(prev.time + step, workout.end);
    if (to <= from) continue;
    const m = (to - from) / 60_000;
    const fraction = clamp((prev.bpm - restingHr) / reserve, 0, 1);
    const zone = zoneOf(fraction);
    covered += m;
    bpmMinutes += prev.bpm * m;
    reserveMinutes += fraction * m;
    peak = Math.max(peak, prev.bpm);
    zoneMinutes[zone] = zoneMinutes[zone]! + m;
    zoneKcal[zone] = zoneKcal[zone]! + (kcalPerMinute(prev.bpm, fraction) - restPerMinute) * m;
    if (fraction >= MIN_EFFORT_FRACTION) zoneTrimp[zone - 1] = zoneTrimp[zone - 1]! + m * fraction * 0.64 * Math.exp(1.92 * fraction);
  }

  // Strain: heart rate, then the effort rating's top-up (the same rule as the day's strain).
  const trimp = zoneTrimp.reduce((a, b) => a + b, 0);
  const effortTrimp = workout.effort ? Math.max(0, workout.effort * minutes * SESSION_RPE_TO_TRIMP - trimp) : 0;
  const total = trimp + effortTrimp;
  const strain = strainFromTrimp(total);
  const strainSplit = total > 0 ? roundToTotal([...zoneTrimp, effortTrimp].map((t) => (strain * t) / total), strain, 1) : [0, 0, 0, 0, 0, 0];

  // Calories: resting for the whole time, plus what each zone added, plus METs where the band saw nothing.
  const met = WORKOUT_METS[workout.kind] ?? WORKOUT_METS.other!;
  const uncovered = Math.max(minutes - covered, 0);
  const resting = restPerMinute * minutes;
  const noHeartRate = (met - 1) * restPerMinute * uncovered;
  const kcal = resting + zoneKcal.reduce((a, b) => a + b, 0) + noHeartRate;
  const kcalTotal = Math.round(kcal);
  const kcalSplit = roundToTotal([resting, ...zoneKcal, noHeartRate], kcalTotal);

  return {
    minutes: round(minutes),
    heartRateMinutes: round(covered),
    avgBpm: covered > 0 ? Math.round(bpmMinutes / covered) : null,
    peakBpm: covered > 0 ? peak : null,
    avgReserve: covered > 0 ? round(reserveMinutes / covered, 2) : null,
    zoneMinutes: zoneMinutes.map((m) => round(m)) as WorkoutAnalysis["zoneMinutes"],
    trimp: round(trimp, 1),
    effortTrimp: round(effortTrimp, 1),
    strain,
    strainParts: { zones: strainSplit.slice(0, 5) as WorkoutAnalysis["strainParts"]["zones"], effort: strainSplit[5]! },
    heartRateEffort: covered >= minutes / 2 && minutes > 0 ? clamp(Math.round(trimp / (minutes * SESSION_RPE_TO_TRIMP)), 1, 10) : null,
    calories: {
      total: kcalTotal,
      resting: kcalSplit[0]!,
      active: kcalTotal - kcalSplit[0]!,
      extra: { zones: kcalSplit.slice(1, 7) as WorkoutCalories["extra"]["zones"], noHeartRate: kcalSplit[7]! },
      basis: {
        weightKg,
        age,
        ...(profile.sex ? { sex: profile.sex } : {}),
        weightKnown: profile.weightKg != null,
        ageKnown: profile.ageKnown ?? false,
        met,
      },
    },
  };
}

/** Age in whole years on `at` from a YYYY-MM-DD birth date. */
export function ageOn(birthDate: string, at: number): number {
  const [y, m, d] = birthDate.split("-").map(Number) as [number, number, number];
  const now = new Date(at);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}
