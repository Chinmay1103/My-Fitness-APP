import { clamp, round } from "./stats";
import { estimateMaxHr } from "./strain";
import type { HeartRateSample, UserProfile } from "./types";

const MAX_GAP_MINUTES = 5;
/** Heart-rate-reserve fractions where Fitbit's fat burn, cardio and peak zones start. */
const FAT_BURN = 0.4;
const CARDIO = 0.6;
const PEAK = 0.85;
/** The weekly goal health bodies recommend (150 minutes of moderate activity), as Fitbit uses it. */
export const WEEKLY_ZONE_MINUTES_GOAL = 150;

export interface ZoneMinutes {
  /** Active Zone Minutes: 1 per minute in fat burn, 2 per minute in cardio or peak, as Fitbit counts them. */
  total: number;
  fatBurn: number;
  cardio: number;
  peak: number;
}

/** Active Zone Minutes for one stretch of heart rate (usually the waking day). */
export function activeZoneMinutes(samples: HeartRateSample[], restingHr: number, profile: UserProfile): ZoneMinutes {
  const reserve = Math.max(estimateMaxHr(profile) - restingHr, 1);
  const sorted = [...samples].sort((a, b) => a.time - b.time);
  let fatBurn = 0;
  let cardio = 0;
  let peak = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const minutes = clamp((sorted[i]!.time - prev.time) / 60_000, 0, MAX_GAP_MINUTES);
    const fraction = (prev.bpm - restingHr) / reserve;
    if (fraction >= PEAK) peak += minutes;
    else if (fraction >= CARDIO) cardio += minutes;
    else if (fraction >= FAT_BURN) fatBurn += minutes;
  }
  const r = { fatBurn: Math.round(fatBurn), cardio: Math.round(cardio), peak: Math.round(peak) };
  return { ...r, total: r.fatBurn + 2 * (r.cardio + r.peak) };
}

/**
 * Share of the weekly 150-minute goal reached over the 7 days ending with `dailyTotals`' last
 * entry, 0–1 and beyond (not capped, so "120%" is possible).
 */
export function weeklyZoneProgress(dailyTotals: number[]): { minutes: number; progress: number } {
  const minutes = dailyTotals.slice(-7).reduce((a, b) => a + b, 0);
  return { minutes, progress: round(minutes / WEEKLY_ZONE_MINUTES_GOAL, 2) };
}
