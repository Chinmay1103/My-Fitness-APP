import type { DailyScores, StrainActivity } from '@fitness/scoring';
import type { SymbolViewProps } from 'expo-symbols';

import { formatMinutes, formatTime } from './format';

export type WorkoutKind = 'strength' | 'run' | 'cycle' | 'walk' | 'sport' | 'class' | 'other';

export interface SetEntry {
  reps: number | null;
  weightKg: number | null;
}

export interface Exercise {
  name: string;
  sets: SetEntry[];
}

/**
 * One logged session. Stored on the phone for now (lib/WorkoutsProvider.tsx); the fields map onto
 * the `workouts` table in Supabase (kind, started_at, ended_at, title, notes, and the rest in
 * `details`) for when sync is added.
 */
export interface Workout {
  /** UUID, so it can become the Supabase row id as-is. */
  id: string;
  kind: WorkoutKind;
  /** Epoch ms. */
  start: number;
  minutes: number;
  title?: string;
  /** How hard it felt, 1 (very easy) to 10 (all out). */
  effort?: number;
  distanceKm?: number;
  exercises?: Exercise[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

type SymbolNames = Extract<SymbolViewProps['name'], object>;

export const KINDS: Record<
  WorkoutKind,
  { label: string; placeholder: string; icon: SymbolNames; distance?: boolean; exercises?: boolean }
> = {
  strength: {
    label: 'Gym',
    placeholder: 'e.g. Push day',
    icon: { ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' },
    exercises: true,
  },
  run: {
    label: 'Run',
    placeholder: 'e.g. Easy 5k',
    icon: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' },
    distance: true,
  },
  cycle: {
    label: 'Ride',
    placeholder: 'e.g. Morning ride',
    icon: { ios: 'bicycle', android: 'directions_bike', web: 'directions_bike' },
    distance: true,
  },
  walk: {
    label: 'Walk',
    placeholder: 'e.g. Evening walk',
    icon: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
    distance: true,
  },
  sport: {
    label: 'Sport',
    placeholder: 'e.g. Football, badminton',
    icon: { ios: 'sportscourt', android: 'sports_soccer', web: 'sports_soccer' },
  },
  class: {
    label: 'Class',
    placeholder: 'e.g. Yoga, HIIT',
    icon: { ios: 'figure.yoga', android: 'self_improvement', web: 'self_improvement' },
  },
  other: {
    label: 'Other',
    placeholder: 'What did you do?',
    icon: { ios: 'bolt', android: 'bolt', web: 'bolt' },
  },
};

export const KIND_ORDER: WorkoutKind[] = ['strength', 'run', 'cycle', 'walk', 'sport', 'class', 'other'];

export function effortLabel(effort: number): string {
  if (effort <= 3) return 'Easy';
  if (effort <= 6) return 'Moderate';
  if (effort <= 8) return 'Hard';
  return 'All out';
}

/** Random v4 UUID. Not cryptographic, which is fine for a row id. */
export function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function workoutTitle(w: Workout): string {
  return w.title?.trim() || KINDS[w.kind].label;
}

/** "5:40 /km" for runs and walks, "24.1 km/h" for rides. */
export function paceText(kind: WorkoutKind, minutes: number, distanceKm: number): string | null {
  if (!distanceKm || !minutes) return null;
  if (kind === 'cycle') return `${(distanceKm / (minutes / 60)).toFixed(1)} km/h`;
  const perKm = minutes / distanceKm;
  const m = Math.floor(perKm);
  const s = Math.round((perKm - m) * 60);
  return s === 60 ? `${m + 1}:00 /km` : `${m}:${String(s).padStart(2, '0')} /km`;
}

/** One line under the title, e.g. "5 exercises · 16 sets" or "5.2 km · 5:40 /km". */
export function workoutSummary(w: Workout): string {
  const parts: string[] = [formatMinutes(w.minutes)];
  if (KINDS[w.kind].exercises && w.exercises?.length) {
    const sets = w.exercises.reduce((n, e) => n + e.sets.length, 0);
    parts.push(`${w.exercises.length} exercise${w.exercises.length === 1 ? '' : 's'}`, `${sets} sets`);
  }
  if (KINDS[w.kind].distance && w.distanceKm) {
    parts.push(`${w.distanceKm} km`);
    const pace = paceText(w.kind, w.minutes, w.distanceKm);
    if (pace) parts.push(pace);
  }
  if (w.effort) parts.push(`effort ${w.effort}/10`);
  return parts.join(' · ');
}

/** "Today", "Yesterday" or "Mon 28 Sep". */
export function dayLabel(time: number, now = Date.now()): string {
  const day = (t: number) => new Date(t).toDateString();
  if (day(time) === day(now)) return 'Today';
  if (day(time) === day(now - 86400000)) return 'Yesterday';
  return new Date(time).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function timeRange(start: number, minutes: number): string {
  return `${formatTime(start)} – ${formatTime(start + minutes * 60000)}`;
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/** A stretch of effort the band picked up (from the strain score), with its day. */
export type DetectedActivity = StrainActivity & { date: string };

export function detectedActivities(scores: DailyScores[], days = 3): DetectedActivity[] {
  return scores.slice(-days).flatMap((s) => s.strain.activities.map((a) => ({ ...a, date: s.date })));
}

/** An activity counts as logged when a workout covers at least half of it. */
function covers(w: Workout, a: StrainActivity): boolean {
  return overlap(w.start, w.start + w.minutes * 60000, a.start, a.end) >= (a.end - a.start) / 2;
}

/** Detected activities no workout has been logged for yet, newest first. */
export function unlabeledActivities(activities: DetectedActivity[], workouts: Workout[]): DetectedActivity[] {
  return activities.filter((a) => !workouts.some((w) => covers(w, a))).sort((a, b) => b.start - a.start);
}

/** Strain the band measured during a workout: the activities it covers. Null if none. */
export function workoutStrain(w: Workout, activities: DetectedActivity[]): number | null {
  const matched = activities.filter((a) => covers(w, a));
  if (!matched.length) return null;
  return Math.round(matched.reduce((sum, a) => sum + a.strain, 0) * 10) / 10;
}
