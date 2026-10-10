import type { DayData, HabitEntry, LoggedWorkout } from '@fitness/scoring';

import { localDate } from './format';
import { supabase } from './supabase';

/**
 * What the user told the coach (workouts, meals, weigh-ins), read back from Supabase. The coach
 * writes these through the connector (supabase/functions/mcp); the app only reads them.
 */

export interface LoggedMeal {
  id: string;
  eatenAt: number;
  description: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface LoggedWeight {
  id: string;
  measuredAt: number;
  kg: number;
}

/** A logged workout with everything the coach recorded, for the workout history. */
export interface LoggedWorkoutDetail extends LoggedWorkout {
  distanceKm?: number;
  exercises?: { name: string; sets: { reps: number | null; weightKg: number | null }[] }[];
  notes?: string;
}

export interface LoggedHabit extends HabitEntry {
  id: string;
  occurredAt: number;
  note?: string;
}

export interface Logged {
  workouts: LoggedWorkoutDetail[];
  meals: LoggedMeal[];
  weights: LoggedWeight[];
  habits: LoggedHabit[];
}

export const NOTHING_LOGGED: Logged = { workouts: [], meals: [], weights: [], habits: [] };

/** Everything logged since `from`, or nothing when signed out or offline (logging is a bonus, not core data). */
export async function fetchLogged(from: Date): Promise<Logged> {
  if (!supabase) return NOTHING_LOGGED;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return NOTHING_LOGGED;
  const since = from.toISOString();
  const [workouts, meals, weights, habits] = await Promise.all([
    supabase.from('workouts').select('id, kind, title, started_at, ended_at, details, notes').gte('started_at', since),
    supabase.from('meals').select('id, eaten_at, description, calories, protein_g, carbs_g, fat_g').gte('eaten_at', since),
    // Weight changes slowly: a longer look back, so the trend has something to show.
    supabase
      .from('body_weights')
      .select('id, measured_at, weight_kg')
      .gte('measured_at', new Date(from.getTime() - 120 * 86_400_000).toISOString()),
    supabase.from('habits').select('id, kind, occurred_at, amount, note').gte('occurred_at', since),
  ]);
  return {
    workouts: (workouts.data ?? [])
      .map((w): LoggedWorkoutDetail => {
        const start = Date.parse(w.started_at);
        const details = (w.details ?? {}) as { effort?: number | null; distanceKm?: number | null; exercises?: LoggedWorkoutDetail['exercises'] | null };
        return {
          id: w.id,
          start,
          end: w.ended_at ? Date.parse(w.ended_at) : start + 60 * 60_000,
          kind: w.kind,
          title: w.title ?? undefined,
          effort: details.effort ?? undefined,
          distanceKm: details.distanceKm ?? undefined,
          exercises: details.exercises ?? undefined,
          notes: w.notes ?? undefined,
        };
      })
      .sort((a, b) => a.start - b.start),
    habits: (habits.data ?? []).map((h) => ({
      id: h.id,
      kind: h.kind,
      occurredAt: Date.parse(h.occurred_at),
      date: localDate(Date.parse(h.occurred_at)),
      amount: h.amount == null ? undefined : Number(h.amount),
      note: h.note ?? undefined,
    })),
    meals: (meals.data ?? [])
      .map((m) => ({
        id: m.id,
        eatenAt: Date.parse(m.eaten_at),
        description: m.description,
        calories: m.calories,
        proteinG: m.protein_g == null ? null : Number(m.protein_g),
        carbsG: m.carbs_g == null ? null : Number(m.carbs_g),
        fatG: m.fat_g == null ? null : Number(m.fat_g),
      }))
      .sort((a, b) => a.eatenAt - b.eatenAt),
    weights: (weights.data ?? [])
      .map((w) => ({ id: w.id, measuredAt: Date.parse(w.measured_at), kg: Number(w.weight_kg) }))
      .sort((a, b) => a.measuredAt - b.measuredAt),
  };
}

/** Puts each logged workout on the day it started, so it counts toward that day's strain. */
export function attachWorkouts(days: DayData[], workouts: LoggedWorkout[]): DayData[] {
  if (!workouts.length) return days;
  return days.map((day) => {
    const mine = workouts.filter((w) => localDate(w.start) === day.date);
    return mine.length ? { ...day, workouts: mine } : day;
  });
}

/** One day's meals added up. Null fields stay null when no meal that day had them. */
export function dayNutrition(meals: LoggedMeal[], date: string) {
  const mine = meals.filter((m) => localDate(m.eatenAt) === date);
  const sum = (pick: (m: LoggedMeal) => number | null) => {
    const values = mine.map(pick).filter((v): v is number => v != null);
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0)) : null;
  };
  return {
    meals: mine,
    calories: sum((m) => m.calories),
    proteinG: sum((m) => m.proteinG),
    carbsG: sum((m) => m.carbsG),
    fatG: sum((m) => m.fatG),
  };
}
