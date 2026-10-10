import { clamp, round, roundToTotal } from "./stats";
import type { HeartRateSample, LoggedWorkout, UserProfile } from "./types";

/** Longer gaps between samples are treated as missing data, not as time at the last heart rate. */
const MAX_GAP_MINUTES = 5;
/** Below 30% of heart-rate reserve counts as everyday activity and adds no strain. */
const MIN_EFFORT_FRACTION = 0.3;
/** Controls how fast strain saturates toward 21. A TRIMP of ~140 (a hard hour) gives ~14. */
const STRAIN_SCALE = 120;
/** Effort separated by a pause shorter than this counts as one activity. */
const ACTIVITY_MERGE_MINUTES = 10;
/** Shorter bursts are lumped into everyday activity. */
const MIN_ACTIVITY_MINUTES = 10;
/**
 * Turns a logged workout's session RPE (effort 1-10 x minutes, Foster's method) into TRIMP, so a
 * hard hour by feel (8 x 60) matches a hard hour by heart rate (~120 TRIMP, strain ~13).
 */
export const SESSION_RPE_TO_TRIMP = 0.25;

/** Heart-rate-reserve zone lower bounds, zone 1 to zone 5. */
export const ZONE_BOUNDS = [0.3, 0.5, 0.6, 0.7, 0.8] as const;

export function estimateMaxHr(profile: UserProfile): number {
  // Tanaka formula: better than 220 - age for adults.
  return profile.maxHr ?? Math.round(208 - 0.7 * profile.age);
}

/** Zone 0-4 (zone 1-5) for a heart rate, or -1 below zone 1 (resting and easy everyday movement). */
export function heartRateZone(bpm: number, restingHr: number, maxHr: number): number {
  const fraction = (bpm - restingHr) / Math.max(maxHr - restingHr, 1);
  let zone = -1;
  while (zone < ZONE_BOUNDS.length - 1 && fraction >= ZONE_BOUNDS[zone + 1]!) zone++;
  return zone;
}

export interface StrainResult {
  /** 0 to 21, one decimal. */
  strain: number;
  /** Banister training impulse, the raw load behind the strain score. */
  trimp: number;
  /** Minutes in zones 1 to 5. */
  zoneMinutes: [number, number, number, number, number];
  /** Stretches of sustained effort, with the strain each one added. */
  activities: StrainActivity[];
  /** Strain from short bursts outside those stretches. Activities plus this equals `strain`. */
  everydayStrain: number;
}

export interface StrainActivity {
  start: number;
  end: number;
  /** Minutes above 30% of heart-rate reserve. */
  minutes: number;
  avgBpm: number;
  maxBpm: number;
  strain: number;
  /** The logged workout this stretch matches, if any. */
  workout?: { id: string; kind: string; title?: string };
  /**
   * Part of `strain` that came from the workout's effort rating rather than heart rate: heart rate
   * misses much of the load of lifting, so a logged effort can top it up (never lower it).
   */
  effortStrain?: number;
}

export function strainFromTrimp(trimp: number): number {
  return round(21 * (1 - Math.exp(-trimp / STRAIN_SCALE)), 1);
}

type Block = {
  start: number;
  end: number;
  minutes: number;
  trimp: number;
  bpmMinutes: number;
  maxBpm: number;
  workout?: LoggedWorkout;
  effortTrimp: number;
};

export function computeStrain(
  samples: HeartRateSample[],
  restingHr: number,
  profile: UserProfile,
  /** Logged workouts that day; one with an effort rating can add the load heart rate missed. */
  workouts: LoggedWorkout[] = [],
): StrainResult {
  const maxHr = estimateMaxHr(profile);
  const reserve = Math.max(maxHr - restingHr, 1);
  const sorted = [...samples].sort((a, b) => a.time - b.time);
  const zoneMinutes: StrainResult["zoneMinutes"] = [0, 0, 0, 0, 0];
  let trimp = 0;
  const blocks: Block[] = [];
  /** Heart-rate TRIMP inside each workout's time, to compare with its effort rating. */
  const insideWorkout = workouts.map(() => 0);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const minutes = Math.min((sorted[i]!.time - prev.time) / 60_000, MAX_GAP_MINUTES);
    const fraction = clamp((prev.bpm - restingHr) / reserve, 0, 1);
    if (minutes <= 0 || fraction < MIN_EFFORT_FRACTION) continue;

    const load = minutes * fraction * 0.64 * Math.exp(1.92 * fraction);
    trimp += load;
    const end = prev.time + minutes * 60_000;
    workouts.forEach((w, k) => {
      const overlap = Math.min(end, w.end) - Math.max(prev.time, w.start);
      if (overlap > 0) insideWorkout[k] = insideWorkout[k]! + (load * overlap) / (end - prev.time);
    });
    const last = blocks.at(-1);
    if (last && prev.time - last.end <= ACTIVITY_MERGE_MINUTES * 60_000) {
      last.end = end;
      last.minutes += minutes;
      last.trimp += load;
      last.bpmMinutes += prev.bpm * minutes;
      last.maxBpm = Math.max(last.maxBpm, prev.bpm);
    } else {
      blocks.push({ start: prev.time, end, minutes, trimp: load, bpmMinutes: prev.bpm * minutes, maxBpm: prev.bpm, effortTrimp: 0 });
    }
    let zone = 0;
    while (zone < ZONE_BOUNDS.length - 1 && fraction >= ZONE_BOUNDS[zone + 1]!) zone++;
    zoneMinutes[zone] = zoneMinutes[zone]! + minutes;
  }

  // Logged workouts: match each to the stretch of effort it covers most, and where its effort
  // rating says it was harder than heart rate showed, add the difference.
  workouts.forEach((w, k) => {
    const minutes = (w.end - w.start) / 60_000;
    if (minutes <= 0) return;
    const extra = w.effort ? Math.max(0, w.effort * minutes * SESSION_RPE_TO_TRIMP - insideWorkout[k]!) : 0;
    let best: Block | undefined;
    let bestOverlap = 0;
    for (const b of blocks) {
      const overlap = Math.min(b.end, w.end) - Math.max(b.start, w.start);
      if (overlap > bestOverlap && !b.workout) {
        best = b;
        bestOverlap = overlap;
      }
    }
    if (!best && extra <= 0) return;
    if (!best) {
      // Heart rate saw nothing of it (e.g. a calm lifting session): the workout is its own activity.
      best = { start: w.start, end: w.end, minutes: 0, trimp: 0, bpmMinutes: 0, maxBpm: 0, effortTrimp: 0 };
      blocks.push(best);
    }
    best.workout = w;
    best.trimp += extra;
    best.effortTrimp += extra;
    trimp += extra;
  });
  blocks.sort((a, b) => a.start - b.start);

  // Share the day's strain out by each activity's part of the load.
  const strain = strainFromTrimp(trimp);
  const kept = blocks.filter((b) => b.minutes >= MIN_ACTIVITY_MINUTES || b.workout);
  const everydayTrimp = trimp - kept.reduce((sum, b) => sum + b.trimp, 0);
  const shares = trimp > 0 ? [...kept.map((b) => b.trimp), everydayTrimp].map((t) => (strain * t) / trimp) : [0];
  const split = roundToTotal(shares, strain, 1);

  return {
    strain,
    trimp: round(trimp, 1),
    zoneMinutes: zoneMinutes.map((m) => round(m)) as StrainResult["zoneMinutes"],
    activities: kept.map((b, i) => {
      const activity: StrainActivity = {
        start: b.start,
        end: b.end,
        minutes: round(b.minutes),
        avgBpm: b.minutes > 0 ? Math.round(b.bpmMinutes / b.minutes) : 0,
        maxBpm: b.maxBpm,
        strain: split[i]!,
      };
      if (b.workout) activity.workout = { id: b.workout.id, kind: b.workout.kind, title: b.workout.title };
      if (b.effortTrimp > 0) activity.effortStrain = Math.min(round((split[i]! * b.effortTrimp) / b.trimp, 1), split[i]!);
      return activity;
    }),
    everydayStrain: split.at(-1)!,
  };
}
