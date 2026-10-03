import { daySamples, estimateMaxHr, MOCK_PROFILE, type DayData, type HeartRateSample } from '@fitness/scoring';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useScores } from './ScoresProvider';

/** How often today's heart rate is re-read while a screen showing it is open. */
const POLL_MS = 60 * 1000;
const FALLBACK_RESTING_HR = 60;

function localMidnight(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

/**
 * Heart rate for one calendar day. For today it re-reads the health source every minute while the
 * screen is in focus and the app is open, so new readings appear without pulling to refresh.
 * `checkedAt` is when we last looked; the newest sample can be older, since the band syncs in batches.
 */
export function useDayHeartRate(date: string | undefined) {
  const { days, getHeartRate, loading } = useScores();
  const day = days.find((d) => d.date === date);
  const base = useMemo(() => daySamples(day), [day]);
  const isToday = !!date && date === days.at(-1)?.date;
  const [fresh, setFresh] = useState<{ date: string; samples: HeartRateSample[]; checkedAt: number } | null>(null);

  const poll = useCallback(async () => {
    if (!date || !isToday) return;
    try {
      const samples = await getHeartRate(localMidnight(date), new Date());
      setFresh({ date, samples, checkedAt: Date.now() });
    } catch {
      // Keep showing what we have; the next poll or a pull-to-refresh tries again.
    }
  }, [date, isToday, getHeartRate]);

  useFocusEffect(
    useCallback(() => {
      if (!isToday) return;
      poll();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') poll();
      }, POLL_MS);
      return () => clearInterval(timer);
    }, [isToday, poll]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') poll();
    });
    return () => subscription.remove();
  }, [poll]);

  // Use the fresh read when it's for this day and has at least what the full load had.
  const useFresh = fresh && fresh.date === date && fresh.samples.length >= base.length;
  return {
    samples: useFresh ? fresh.samples : base,
    checkedAt: useFresh ? fresh.checkedAt : null,
    isToday,
    loading,
    day,
  };
}

/** Resting and max heart rate for drawing zones: the same numbers the strain score uses. */
export function heartRateLimits(days: DayData[], date: string | undefined): { restingHr: number; maxHr: number } {
  const day = days.find((d) => d.date === date);
  const recent = days.flatMap((d) => (d.restingHr ? [d.restingHr] : [])).slice(-30).sort((a, b) => a - b);
  return {
    restingHr: day?.restingHr ?? recent[Math.floor(recent.length / 2)] ?? FALLBACK_RESTING_HR,
    // TODO(milestone 3): the user's real age, like ScoresProvider.
    maxHr: estimateMaxHr(MOCK_PROFILE),
  };
}

/** "just now", "4 min ago", "2 h ago". */
export function ago(time: number, now = Date.now()): string {
  const minutes = Math.round((now - time) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}
