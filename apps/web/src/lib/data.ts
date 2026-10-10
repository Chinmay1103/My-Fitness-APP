import type { DailyScores, RecoveryZone, SleepStageMinutes } from '@fitness/scoring';

import { localDate, localMinutes } from './dates';
import { supabase } from './supabase';

/**
 * Everything the website shows, read from the same Supabase tables the phone syncs to and the
 * coach writes to. The phone keeps ~30 days; the cloud keeps every day ever synced, which is what
 * makes long trends possible here. Read-only: nothing on the website changes a score or a log.
 */

export interface Day {
  date: string;
  recovery: number | null;
  zone: RecoveryZone | null;
  calibrating: boolean;
  strain: number;
  sleepScore: number | null;
  /** Minutes asleep and minutes needed. */
  asleep: number | null;
  need: number | null;
  hrv: number | null;
  restingHr: number | null;
  /** Bedtime and wake time in minutes from midnight of this date (bedtime is usually negative: -30 = 11:30 PM the evening before). */
  bedtime: number | null;
  wake: number | null;
  stages: SleepStageMinutes | null;
  /** Display-only extras (null until the phone has synced them; see the daily_summary_extras migration). */
  steps: number | null;
  zoneMinutes: number | null;
  spo2: number | null;
  breathing: number | null;
  skinTemp: number | null;
  energy: number | null;
  hrAvg: number | null;
  scores: DailyScores;
}

export interface Workout {
  id: string;
  date: string;
  start: number;
  end: number;
  kind: string;
  title: string | null;
  effort: number | null;
  distanceKm: number | null;
  notes: string | null;
}

export interface Meal {
  id: string;
  date: string;
  eatenAt: number;
  description: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface Weight {
  date: string;
  measuredAt: number;
  kg: number;
}

export interface Habit {
  date: string;
  kind: string;
  amount: number | null;
  note: string | null;
}

export interface CoachNote {
  date: string;
  headline: string;
  why: string;
  tips: string[];
}

export interface WeeklyReport {
  weekEnd: string;
  headline: string;
  summary: string;
  focus: string;
}

export interface Dataset {
  days: Day[];
  workouts: Workout[];
  meals: Meal[];
  weights: Weight[];
  habits: Habit[];
  notes: CoachNote[];
  reports: WeeklyReport[];
  timeZone: string | undefined;
  demo: boolean;
}

interface SummaryRow {
  date: string;
  resting_hr: number | null;
  hrv_rmssd: number | null;
  sleep_start: string | null;
  sleep_end: string | null;
  asleep_minutes: number | null;
  heart_rate: { avg?: number } | null;
  extras: {
    steps?: number | null;
    zone_minutes?: number | null;
    spo2?: number | null;
    breathing?: number | null;
    skin_temp_delta?: number | null;
    calories_burned?: number | null;
    sleep_stages?: SleepStageMinutes | null;
  } | null;
  scores: DailyScores;
}

/** Turns a synced row into a Day. Exported for the demo data, which builds the same rows. */
export function dayFromRow(row: SummaryRow, timeZone?: string): Day {
  const s = row.scores;
  const x = row.extras ?? {};
  let bedtime: number | null = null;
  let wake: number | null = null;
  if (row.sleep_start && row.sleep_end) {
    const bed = localMinutes(Date.parse(row.sleep_start), timeZone);
    // Bed after noon belongs to the evening before.
    bedtime = bed >= 12 * 60 ? bed - 1440 : bed;
    wake = localMinutes(Date.parse(row.sleep_end), timeZone);
  }
  return {
    date: row.date,
    recovery: s.recovery?.score ?? null,
    zone: s.recovery?.zone ?? null,
    calibrating: s.recovery?.calibrating ?? false,
    strain: s.strain.strain,
    sleepScore: s.sleep?.score ?? null,
    asleep: s.sleep?.asleepMinutes ?? row.asleep_minutes ?? null,
    need: s.sleep?.needMinutes ?? null,
    hrv: row.hrv_rmssd,
    restingHr: row.resting_hr,
    bedtime,
    wake,
    stages: x.sleep_stages ?? null,
    steps: x.steps ?? null,
    zoneMinutes: x.zone_minutes ?? null,
    spo2: x.spo2 ?? null,
    breathing: x.breathing ?? null,
    skinTemp: x.skin_temp_delta ?? null,
    energy: x.calories_burned ?? null,
    hrAvg: row.heart_rate?.avg ?? null,
    scores: s,
  };
}

const PAGE = 1000;

/** Supabase returns at most 1000 rows per request; this reads them all, page by page. */
async function readAll<T>(table: string, columns: string, order: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns).order(order).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

export async function fetchDataset(): Promise<Dataset> {
  const { data: profile } = await supabase.from('profiles').select('timezone').maybeSingle();
  const timeZone: string | undefined = profile?.timezone ?? undefined;
  const [rows, workouts, meals, weights, habits, notes, reports] = await Promise.all([
    readAll<SummaryRow>(
      'daily_summaries',
      'date, resting_hr, hrv_rmssd, sleep_start, sleep_end, asleep_minutes, heart_rate, extras, scores',
      'date',
    ),
    readAll<{ id: string; kind: string; title: string | null; started_at: string; ended_at: string | null; details: Record<string, unknown> | null; notes: string | null }>(
      'workouts',
      'id, kind, title, started_at, ended_at, details, notes',
      'started_at',
    ),
    readAll<{ id: string; eaten_at: string; description: string | null; calories: number | null; protein_g: string | number | null; carbs_g: string | number | null; fat_g: string | number | null }>(
      'meals',
      'id, eaten_at, description, calories, protein_g, carbs_g, fat_g',
      'eaten_at',
    ),
    readAll<{ measured_at: string; weight_kg: string | number }>('body_weights', 'measured_at, weight_kg', 'measured_at'),
    readAll<{ kind: string; occurred_at: string; amount: string | number | null; note: string | null }>('habits', 'kind, occurred_at, amount, note', 'occurred_at'),
    readAll<{ date: string; headline: string; why: string; tips: string[] }>('daily_notes', 'date, headline, why, tips', 'date'),
    readAll<{ week_end: string; headline: string; summary: string; focus: string }>('weekly_reports', 'week_end, headline, summary, focus', 'week_end'),
  ]);
  const num = (v: string | number | null | undefined) => (v == null ? null : Number(v));
  return {
    timeZone,
    demo: false,
    days: rows.map((r) => dayFromRow(r, timeZone)),
    workouts: workouts.map((w) => {
      const start = Date.parse(w.started_at);
      const d = w.details ?? {};
      return {
        id: w.id,
        date: localDate(start, timeZone),
        start,
        end: w.ended_at ? Date.parse(w.ended_at) : start + 60 * 60_000,
        kind: w.kind,
        title: w.title,
        effort: num(d.effort as number | null),
        distanceKm: num(d.distanceKm as number | null),
        notes: w.notes,
      };
    }),
    meals: meals.map((m) => {
      const eatenAt = Date.parse(m.eaten_at);
      return {
        id: m.id,
        date: localDate(eatenAt, timeZone),
        eatenAt,
        description: m.description,
        calories: m.calories,
        proteinG: num(m.protein_g),
        carbsG: num(m.carbs_g),
        fatG: num(m.fat_g),
      };
    }),
    weights: weights.map((w) => {
      const measuredAt = Date.parse(w.measured_at);
      return { date: localDate(measuredAt, timeZone), measuredAt, kg: Number(w.weight_kg) };
    }),
    habits: habits.map((h) => ({ date: localDate(Date.parse(h.occurred_at), timeZone), kind: h.kind, amount: num(h.amount), note: h.note })),
    notes,
    reports: reports.map((r) => ({ weekEnd: r.week_end, headline: r.headline, summary: r.summary, focus: r.focus })),
  };
}
