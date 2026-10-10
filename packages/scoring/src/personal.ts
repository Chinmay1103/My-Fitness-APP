import type { DailyScores } from "./daily";
import { clamp, median } from "./stats";

/**
 * Your own sleep need, learned from the nights you recovered best after, instead of a fixed 8 h.
 * Takes the top third of mornings by recovery, looks at how long you slept before them (minus the
 * extra a hard day added), and moves from 8 h towards that as nights add up. Needs 14 scored
 * nights; stays within 6.5–9.5 h.
 */

export interface LearnedSleepNeed {
  /** The base need to use, minutes (rounded to 5). */
  minutes: number;
  /** What the best nights alone suggest, before blending with the default. */
  bestNights: number;
  /** Nights it learned from. */
  nights: number;
}

const DEFAULT_MINUTES = 480;
const MIN_NIGHTS = 14;
/** Trust grows with nights: at 14 nights it's halfway between the default and what it learned. */
const PRIOR_NIGHTS = 14;

export function learnSleepNeed(scores: DailyScores[], defaultMinutes = DEFAULT_MINUTES): LearnedSleepNeed | null {
  const nights = scores.slice(-60).filter((s) => s.sleep && s.recovery?.score != null && s.sleepNeed);
  if (nights.length < MIN_NIGHTS) return null;
  const best = [...nights].sort((a, b) => b.recovery!.score! - a.recovery!.score!).slice(0, Math.ceil(nights.length / 3));
  // Take out what a hard day before added, so this is the base need, not the day's total.
  const learned = median(best.map((s) => s.sleep!.asleepMinutes - s.sleepNeed!.strain));
  const weight = nights.length / (nights.length + PRIOR_NIGHTS);
  const minutes = Math.round(clamp(defaultMinutes + (learned - defaultMinutes) * weight, 390, 570) / 5) * 5;
  return { minutes, bestNights: Math.round(learned), nights: nights.length };
}
