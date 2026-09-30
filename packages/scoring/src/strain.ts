import { clamp, round, roundToTotal } from "./stats";
import type { HeartRateSample, UserProfile } from "./types";

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

/** Heart-rate-reserve zone lower bounds, zone 1 to zone 5. */
export const ZONE_BOUNDS = [0.3, 0.5, 0.6, 0.7, 0.8] as const;

export function estimateMaxHr(profile: UserProfile): number {
  // Tanaka formula: better than 220 - age for adults.
  return profile.maxHr ?? Math.round(208 - 0.7 * profile.age);
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
}

export function strainFromTrimp(trimp: number): number {
  return round(21 * (1 - Math.exp(-trimp / STRAIN_SCALE)), 1);
}

export function computeStrain(
  samples: HeartRateSample[],
  restingHr: number,
  profile: UserProfile,
): StrainResult {
  const maxHr = estimateMaxHr(profile);
  const reserve = Math.max(maxHr - restingHr, 1);
  const sorted = [...samples].sort((a, b) => a.time - b.time);
  const zoneMinutes: StrainResult["zoneMinutes"] = [0, 0, 0, 0, 0];
  let trimp = 0;
  const blocks: { start: number; end: number; minutes: number; trimp: number; bpmMinutes: number; maxBpm: number }[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const minutes = Math.min((sorted[i]!.time - prev.time) / 60_000, MAX_GAP_MINUTES);
    const fraction = clamp((prev.bpm - restingHr) / reserve, 0, 1);
    if (minutes <= 0 || fraction < MIN_EFFORT_FRACTION) continue;

    const load = minutes * fraction * 0.64 * Math.exp(1.92 * fraction);
    trimp += load;
    const end = prev.time + minutes * 60_000;
    const last = blocks.at(-1);
    if (last && prev.time - last.end <= ACTIVITY_MERGE_MINUTES * 60_000) {
      last.end = end;
      last.minutes += minutes;
      last.trimp += load;
      last.bpmMinutes += prev.bpm * minutes;
      last.maxBpm = Math.max(last.maxBpm, prev.bpm);
    } else {
      blocks.push({ start: prev.time, end, minutes, trimp: load, bpmMinutes: prev.bpm * minutes, maxBpm: prev.bpm });
    }
    let zone = 0;
    while (zone < ZONE_BOUNDS.length - 1 && fraction >= ZONE_BOUNDS[zone + 1]!) zone++;
    zoneMinutes[zone] = zoneMinutes[zone]! + minutes;
  }

  // Share the day's strain out by each activity's part of the load.
  const strain = strainFromTrimp(trimp);
  const kept = blocks.filter((b) => b.minutes >= MIN_ACTIVITY_MINUTES);
  const everydayTrimp = trimp - kept.reduce((sum, b) => sum + b.trimp, 0);
  const shares = trimp > 0 ? [...kept.map((b) => b.trimp), everydayTrimp].map((t) => (strain * t) / trimp) : [0];
  const split = roundToTotal(shares, strain, 1);

  return {
    strain,
    trimp: round(trimp, 1),
    zoneMinutes: zoneMinutes.map((m) => round(m)) as StrainResult["zoneMinutes"],
    activities: kept.map((b, i) => ({
      start: b.start,
      end: b.end,
      minutes: round(b.minutes),
      avgBpm: Math.round(b.bpmMinutes / b.minutes),
      maxBpm: b.maxBpm,
      strain: split[i]!,
    })),
    everydayStrain: split.at(-1)!,
  };
}
