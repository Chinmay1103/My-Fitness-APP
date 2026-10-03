import { daySamples, summarizeHeartRate, type DailyScores, type DayData } from '@fitness/scoring';

import type { HealthSource } from './health';
import { supabase } from './supabase';

/** How many recent days to upload on each refresh. Older days rarely change. */
const SYNC_DAYS = 14;

/**
 * Uploads one summary row per day (resting HR, HRV, sleep times, a heart-rate summary and the three
 * scores with their breakdowns) to the signed-in user's `daily_summaries`. Raw heart-rate samples
 * never leave the phone. Demo data is never uploaded. Resolves to whether anything was sent.
 */
export async function syncDailySummaries(
  sourceId: HealthSource['id'],
  days: DayData[],
  scores: DailyScores[],
): Promise<boolean> {
  if (!supabase || sourceId === 'mock') return false;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;

  const byDate = new Map(days.map((d) => [d.date, d]));
  const rows = scores.slice(-SYNC_DAYS).map((s) => {
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
      scores: s,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase.from('daily_summaries').upsert(rows, { onConflict: 'user_id,date' });
  if (error) throw new Error(`Sync failed: ${error.message}`);
  return true;
}
