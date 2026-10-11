import { estimatedMax, exerciseKey, muscleFor, type Muscle } from '@fitness/scoring';

import type { Goals, Meal, Workout } from './data';
import { daysBetween, weekStart } from './dates';
import type { Row } from './metrics';
import { fit, mean, rollingMean } from './stats';

/**
 * The Progress page's math: weight against a goal, food against daily targets, and the sets behind
 * each lift. Display only: none of this changes a score.
 */

/** Each day's weigh-in and the average of the last 7 days' weigh-ins (single weigh-ins swing with water and food). */
export function weightLines(rows: Row[]): { daily: (number | null)[]; avg: (number | null)[] } {
  const daily = rows.map((r) => r.values.weight);
  return { daily, avg: rollingMean(daily, 7, 1) };
}

/** Least-squares trend through the weigh-ins, in kg per week. Null with fewer than 5 weigh-ins. */
export function weeklyRate(rows: Row[]): number | null {
  const first = rows[0]?.date;
  if (!first) return null;
  const points = rows.flatMap((r) => (r.values.weight != null ? [{ x: daysBetween(first, r.date), y: r.values.weight }] : []));
  const f = fit(points);
  return f ? f.slope * 7 : null;
}

export interface GoalTrack {
  start: number;
  now: number;
  goal: number;
  direction: 'gain' | 'lose';
  /** 0 to 1: how far from start to goal (0 when moving the wrong way). */
  done: number;
  remaining: number;
}

/** From the first 7-day average in the range to the latest one, against the goal. */
export function goalTrack(rows: Row[], goalKg: number | null): GoalTrack | null {
  const avg = weightLines(rows).avg.filter((v): v is number => v != null);
  if (goalKg == null || !avg.length) return null;
  const start = avg[0]!;
  const now = avg.at(-1)!;
  const direction = goalKg >= start ? 'gain' : 'lose';
  const span = goalKg - start;
  const done = span === 0 ? 1 : Math.min(1, Math.max(0, (now - start) / span));
  return { start, now, goal: goalKg, direction, done, remaining: goalKg - now };
}

/** Weeks to the goal at `ratePerWeek` kg (always positive; the direction comes from the goal). */
export function weeksToGoal(nowKg: number, goalKg: number, ratePerWeek: number): number {
  return ratePerWeek > 0 ? Math.abs(goalKg - nowKg) / ratePerWeek : Infinity;
}

export interface WeekWeight {
  /** Monday of the week. */
  start: string;
  avg: number;
  change: number | null;
  readings: number;
}

/** Average weigh-in per calendar week (Monday to Sunday), weeks without one left out. */
export function weeklyWeights(rows: Row[]): WeekWeight[] {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    if (r.values.weight == null) continue;
    const k = weekStart(r.date);
    groups.set(k, [...(groups.get(k) ?? []), r.values.weight]);
  }
  let prev: number | null = null;
  return [...groups.entries()].map(([start, kg]) => {
    const avg = mean(kg)!;
    const out = { start, avg, change: prev == null ? null : avg - prev, readings: kg.length };
    prev = avg;
    return out;
  });
}

export interface FoodDay {
  date: string;
  calories: number;
  protein: number;
  meals: Meal[];
  /** So little logged that the day probably wasn't logged in full: shown, but left out of averages. */
  partial: boolean;
}

/** Under this share of the calorie target (or 1,000 kcal with no target), a day counts as partly logged. */
const PARTIAL_SHARE = 0.5;

export function foodDays(rows: Row[], meals: Meal[], goals: Goals): FoodDay[] {
  const byDate = new Map<string, Meal[]>();
  for (const m of meals) byDate.set(m.date, [...(byDate.get(m.date) ?? []), m]);
  const floor = goals.calories != null ? goals.calories * PARTIAL_SHARE : 1000;
  return rows.flatMap((r) => {
    const list = byDate.get(r.date);
    if (!list?.length) return [];
    const calories = list.reduce((a, m) => a + (m.calories ?? 0), 0);
    const protein = list.reduce((a, m) => a + (m.proteinG ?? 0), 0);
    return [{ date: r.date, calories, protein, meals: [...list].sort((a, b) => a.eatenAt - b.eatenAt), partial: calories < floor }];
  });
}

export interface FoodHits {
  /** Fully logged days. */
  days: number;
  partial: number;
  avgCalories: number | null;
  avgProtein: number | null;
  /** Days at or above the target (null when there's no target). */
  calorieHits: number | null;
  proteinHits: number | null;
}

export function foodHits(days: FoodDay[], goals: Goals): FoodHits {
  const full = days.filter((d) => !d.partial);
  return {
    days: full.length,
    partial: days.length - full.length,
    avgCalories: mean(full.map((d) => d.calories)),
    avgProtein: mean(full.map((d) => d.protein)),
    calorieHits: goals.calories == null ? null : full.filter((d) => d.calories >= goals.calories!).length,
    proteinHits: goals.proteinG == null ? null : full.filter((d) => d.protein >= goals.proteinG!).length,
  };
}

export interface SessionSets {
  date: string;
  sets: { reps: number | null; weightKg: number | null }[];
  /** Index of the best set (estimated max, or most reps for bodyweight work). */
  top: number;
  /** Every set at the session's heaviest weight reached the top of an 8–12 range. */
  readyForMore: boolean;
}

/** Reps at which a weight is "done" and the next step up is due (double progression, 8–12). */
export const TOP_OF_RANGE = 12;

/** Each session's sets for one exercise (matched by name the way the overload table does), oldest first. */
export function exerciseSessions(workouts: Workout[], key: string): SessionSets[] {
  const byDate = new Map<string, SessionSets['sets']>();
  for (const w of [...workouts].sort((a, b) => a.start - b.start)) {
    for (const e of w.exercises) {
      if (exerciseKey(e.name) !== key) continue;
      const sets = e.sets.filter((s) => (s.reps ?? 0) > 0 || (s.weightKg ?? 0) > 0);
      if (sets.length) byDate.set(w.date, [...(byDate.get(w.date) ?? []), ...sets]);
    }
  }
  return [...byDate.entries()].map(([date, sets]) => {
    const bodyweight = sets.every((s) => !s.weightKg);
    let top = 0;
    let best = -Infinity;
    sets.forEach((s, i) => {
      const m = bodyweight ? (s.reps ?? 0) : s.weightKg ? estimatedMax(s.weightKg, s.reps) : 0;
      if (m > best) {
        best = m;
        top = i;
      }
    });
    const heaviest = Math.max(...sets.map((s) => s.weightKg ?? 0));
    const atTop = sets.filter((s) => (s.weightKg ?? 0) === heaviest);
    return { date, sets, top, readyForMore: !bodyweight && atTop.every((s) => (s.reps ?? 0) >= TOP_OF_RANGE) };
  });
}

export type WorkoutGroup = 'upper' | 'lower' | 'cardio' | 'other';

const LOWER: Muscle[] = ['quads', 'hamstrings', 'glutes', 'calves'];

/** Upper or lower body by most of the exercises' muscles; runs, rides and walks are cardio. */
export function workoutGroup(w: Workout): WorkoutGroup {
  if (w.kind === 'run' || w.kind === 'cycle' || w.kind === 'walk') return 'cardio';
  const muscles = w.exercises.map((e) => muscleFor(e.name)).filter((m) => m !== 'other' && m !== 'core');
  if (!muscles.length) return 'other';
  const lower = muscles.filter((m) => LOWER.includes(m)).length;
  return lower * 2 >= muscles.length ? 'lower' : 'upper';
}
