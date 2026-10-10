import type { DayData, LoggedWorkout } from '@fitness/scoring';

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

export interface Logged {
  workouts: LoggedWorkout[];
  meals: LoggedMeal[];
  weights: LoggedWeight[];
}

export const NOTHING_LOGGED: Logged = { workouts: [], meals: [], weights: [] };

/** Everything logged since `from`, or nothing when signed out or offline (logging is a bonus, not core data). */
export async function fetchLogged(from: Date): Promise<Logged> {
  if (!supabase) return NOTHING_LOGGED;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return NOTHING_LOGGED;
  const since = from.toISOString();
  const [workouts, meals, weights] = await Promise.all([
    supabase.from('workouts').select('id, kind, title, started_at, ended_at, details').gte('started_at', since),
    supabase.from('meals').select('id, eaten_at, description, calories, protein_g, carbs_g, fat_g').gte('eaten_at', since),
    // Weight changes slowly: a longer look back, so the trend has something to show.
    supabase
      .from('body_weights')
      .select('id, measured_at, weight_kg')
      .gte('measured_at', new Date(from.getTime() - 120 * 86_400_000).toISOString()),
  ]);
  return {
    workouts: (workouts.data ?? []).map((w) => {
      const start = Date.parse(w.started_at);
      const effort = (w.details as { effort?: number | null } | null)?.effort ?? undefined;
      return {
        id: w.id,
        start,
        end: w.ended_at ? Date.parse(w.ended_at) : start + 60 * 60_000,
        kind: w.kind,
        title: w.title ?? undefined,
        effort: effort ?? undefined,
      };
    }),
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
