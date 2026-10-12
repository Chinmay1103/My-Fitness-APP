import { analyzeWorkout, type DayData, type LoggedWorkout, type UserProfile, type WorkoutAnalysis } from '@fitness/scoring';

import { localDate } from './format';
import type { Logged } from './logged';

/** What a workout is measured against: its day's heart rate, resting heart rate and the weigh-in before it. */
export function workoutInputs(w: LoggedWorkout, days: DayData[], logged: Logged, profile: UserProfile) {
  const i = days.findIndex((d) => d.date === localDate(w.start));
  if (i < 0) return null;
  const day = days[i]!;
  // A workout running past midnight continues in the next day's heart rate.
  const samples = localDate(w.end) !== day.date ? [...day.heartRate, ...(days[i + 1]?.heartRate ?? [])] : day.heartRate;
  const earlier = days.slice(Math.max(0, i - 30), i).flatMap((d) => (d.restingHr ? [d.restingHr] : []));
  const restingHr = day.restingHr ?? (earlier.length ? median(earlier) : 60);
  const weighIn = logged.weights.filter((x) => x.measuredAt <= w.end).at(-1) ?? null;
  return { day, samples, restingHr, weighIn, profile: weighIn ? { ...profile, weightKg: weighIn.kg } : profile };
}

/**
 * A logged workout measured against the band's heart rate for exactly its start-to-end time:
 * how hard it was and the calories it burned (`analyzeWorkout` in scoring). Uses the weigh-in
 * closest before it and the resting heart rate of its day, the same one the day's strain used.
 * Null when its day isn't loaded (older than the phone's 45 days).
 */
export function workoutAnalysis(w: LoggedWorkout, days: DayData[], logged: Logged, profile: UserProfile): WorkoutAnalysis | null {
  const input = workoutInputs(w, days, logged, profile);
  return input ? analyzeWorkout(w, input.samples, input.restingHr, input.profile) : null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Median strain of earlier workouts of the same kind (at least 2), for "harder than your usual run". */
export function usualStrain(w: LoggedWorkout, all: { workout: LoggedWorkout; analysis: WorkoutAnalysis | null }[]): number | null {
  const earlier = all
    .filter((x) => x.workout.kind === w.kind && x.workout.start < w.start && x.analysis)
    .map((x) => x.analysis!.strain);
  return earlier.length >= 2 ? Math.round(median(earlier) * 10) / 10 : null;
}
