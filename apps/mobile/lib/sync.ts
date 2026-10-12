import {
  activeZoneMinutes,
  combineSteps,
  daySamples,
  strainLevel,
  summarizeHeartRate,
  type DailyScores,
  type DayData,
  type UserProfile,
} from '@fitness/scoring';

import type { HealthSource } from './health';
import type { Logged } from './logged';
import { supabase } from './supabase';
import { workoutAnalysis } from './workoutAnalysis';

/** How many recent days to upload on each refresh. Older days rarely change. */
const SYNC_DAYS = 14;

/**
 * Uploads one summary row per day (resting HR, HRV, sleep times, a heart-rate summary, the three
 * scores with their breakdowns, and display-only extras like steps and sleep stages) to the
 * signed-in user's `daily_summaries`. The last 14 days are always sent; older days only when the
 * cloud doesn't have them yet, so the website's history fills in without overwriting a day with a
 * score computed from less history. Raw heart-rate samples never leave the phone. Demo data is
 * never uploaded. Resolves to whether anything was sent.
 */
export async function syncDailySummaries(
  sourceId: HealthSource['id'],
  days: DayData[],
  scores: DailyScores[],
  logged: Logged,
  profile: UserProfile,
): Promise<boolean> {
  if (!supabase || sourceId === 'mock') return false;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;

  const recent = new Set(scores.slice(-SYNC_DAYS).map((s) => s.date));
  const older = scores.filter((s) => !recent.has(s.date)).map((s) => s.date);
  let missing = new Set<string>();
  if (older.length) {
    const { data: have } = await supabase.from('daily_summaries').select('date').in('date', older);
    const stored = new Set((have ?? []).map((r: { date: string }) => r.date));
    missing = new Set(older.filter((d) => !stored.has(d)));
  }

  const byDate = new Map(days.map((d) => [d.date, d]));
  const rows = scores
    .filter((s) => recent.has(s.date) || missing.has(s.date))
    .map((s) => {
      const day = byDate.get(s.date);
      const hr = summarizeHeartRate(daySamples(day));
      return {
        date: s.date,
        source: sourceId,
        resting_hr: day?.restingHr ?? null,
        hrv_rmssd: day?.hrvRmssd ?? null,
        sleep_start: day?.sleep ? new Date(day.sleep.start).toISOString() : null,
        sleep_end: day?.sleep ? new Date(day.sleep.end).toISOString() : null,
        asleep_minutes: s.sleep ? Math.round(s.sleep.asleepMinutes) : null,
        recovery_score: s.recovery?.score ?? null,
        recovery_zone: s.recovery?.zone ?? null,
        strain: s.strain.strain,
        sleep_score: s.sleep?.score ?? null,
        heart_rate: hr && {
          low: hr.low,
          avg: hr.avg,
          high: hr.high,
          latest_bpm: Math.round(hr.latest.bpm),
          latest_at: new Date(hr.latest.time).toISOString(),
          hourly: hr.hourly,
          minutes_covered: hr.minutesCovered,
        },
        extras: day ? dayExtras(day, days, logged, profile) : null,
        scores: s,
        updated_at: new Date().toISOString(),
      };
    });

  let { error } = await supabase.from('daily_summaries').upsert(rows, { onConflict: 'user_id,date' });
  // Until the daily_summary_extras migration is pushed, the column doesn't exist: send the rest.
  if (error && error.message.includes('extras')) {
    ({ error } = await supabase.from('daily_summaries').upsert(rows.map(({ extras: _, ...rest }) => rest), { onConflict: 'user_id,date' }));
  }
  if (error) throw new Error(`Sync failed: ${error.message}`);
  return true;
}

/**
 * Steps, zone minutes, SpO2, breathing, skin temp, energy and sleep stages, for the website's long
 * trends; and each logged workout's heart rate, strain and calories, for the coach's list_workouts.
 */
function dayExtras(day: DayData, days: DayData[], logged: Logged, profile: UserProfile) {
  // Same resting-HR fallback as the Today tiles (lib/metrics.ts): the last week's middle value.
  const i = days.indexOf(day);
  const week = days.slice(Math.max(0, i - 7), i + 1).flatMap((d) => (d.restingHr ? [d.restingHr] : [])).sort((a, b) => a - b);
  const restingHr = day.restingHr ?? week[Math.floor(week.length / 2)] ?? 60;
  const stages = day.sleep?.stages;
  return {
    steps: day.steps?.length ? combineSteps(day.steps, daySamples(day), restingHr).total : null,
    zone_minutes: day.heartRate.length ? activeZoneMinutes(day.heartRate, restingHr, profile).total : null,
    spo2: day.spo2 ?? null,
    breathing: day.respiratoryRate ?? null,
    skin_temp_delta: day.skinTempDelta ?? null,
    calories_burned: day.caloriesBurned ?? null,
    sleep_stages: stages
      ? { awake: Math.round(stages.awake), light: Math.round(stages.light), deep: Math.round(stages.deep), rem: Math.round(stages.rem) }
      : null,
    workouts: (day.workouts ?? []).flatMap((w) => {
      const a = workoutAnalysis(w, days, logged, profile);
      if (!a) return [];
      return [{
        id: w.id,
        strain: a.strain,
        level: strainLevel(a.strain),
        avg_bpm: a.avgBpm,
        peak_bpm: a.peakBpm,
        avg_heart_rate_reserve_pct: a.avgReserve != null ? Math.round(a.avgReserve * 100) : null,
        minutes_with_heart_rate: a.heartRateMinutes,
        zone_minutes: { below_zone_1: a.zoneMinutes[0], z1: a.zoneMinutes[1], z2: a.zoneMinutes[2], z3: a.zoneMinutes[3], z4: a.zoneMinutes[4], z5: a.zoneMinutes[5] },
        heart_rate_effort: a.heartRateEffort,
        strain_from_effort_rating: a.strainParts.effort,
        calories: a.calories.total,
        active_calories: a.calories.active,
        calories_basis: a.calories.basis,
      }];
    }),
  };
}
