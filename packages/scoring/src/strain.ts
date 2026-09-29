import { clamp, round } from "./stats";
import type { HeartRateSample, UserProfile } from "./types";

/** Longer gaps between samples are treated as missing data, not as time at the last heart rate. */
const MAX_GAP_MINUTES = 5;
/** Below 30% of heart-rate reserve counts as everyday activity and adds no strain. */
const MIN_EFFORT_FRACTION = 0.3;
/** Controls how fast strain saturates toward 21. A TRIMP of ~140 (a hard hour) gives ~14. */
const STRAIN_SCALE = 120;

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

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const minutes = Math.min((sorted[i]!.time - prev.time) / 60_000, MAX_GAP_MINUTES);
    const fraction = clamp((prev.bpm - restingHr) / reserve, 0, 1);
    if (minutes <= 0 || fraction < MIN_EFFORT_FRACTION) continue;

    trimp += minutes * fraction * 0.64 * Math.exp(1.92 * fraction);
    let zone = 0;
    while (zone < ZONE_BOUNDS.length - 1 && fraction >= ZONE_BOUNDS[zone + 1]!) zone++;
    zoneMinutes[zone] = zoneMinutes[zone]! + minutes;
  }

  return {
    strain: strainFromTrimp(trimp),
    trimp: round(trimp, 1),
    zoneMinutes: zoneMinutes.map((m) => round(m)) as StrainResult["zoneMinutes"],
  };
}
