import {
  computeDailyScores,
  estimateMaxHr,
  generateMockHabits,
  learnSleepNeed,
  MOCK_PROFILE,
  type DailyScores,
  type DayData,
  type LearnedSleepNeed,
} from '@fitness/scoring';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { mockSource } from './health/mockSource';
import { pickHealthSource, type HealthSource } from './health';
import { publishLatestFromHistory } from './heartRateWidget';
import { liveZone, setHeartRateBaseline } from './liveHeartRate';
import { attachWorkouts, fetchLogged, NOTHING_LOGGED, type Logged } from './logged';
import { computeDayMetrics, type DayMetrics } from './metrics';
import { syncDailySummaries } from './sync';

const HISTORY_DAYS = 45;
/** Coming back to the app after this long re-reads everything, so the scores follow the day. */
const STALE_MS = 5 * 60 * 1000;

interface ScoresState {
  loading: boolean;
  error: string | null;
  sourceLabel: string;
  sourceId: HealthSource['id'];
  /** Reads heart rate straight from the current source, for views that refresh more often than the scores. */
  getHeartRate: HealthSource['getHeartRate'];
  days: DayData[];
  scores: DailyScores[];
  /** Workouts, meals and weigh-ins the user told the coach about. Empty when signed out. */
  logged: Logged;
  /** Steps, SpO2, zone minutes, nutrition... per day, lined up with `days`. Display only. */
  metrics: DayMetrics[];
  /** Your own base sleep need, learned from the nights you recovered best after (null for the first 14). */
  learnedNeed: LearnedSleepNeed | null;
  /** Result of the last upload to Supabase: 'ok', an error message, or null if nothing was sent. */
  syncStatus: string | null;
  refresh: () => Promise<void>;
  /** Uploads the current scores again, so the coach connector sees the latest numbers. */
  syncNow: () => Promise<void>;
  /** Which day the screens show, in days back from the latest: 0 = today. Shared, so Sleep and Strain follow Today. */
  dayBack: number;
  setDayBack: (back: number) => void;
}

const ScoresContext = createContext<ScoresState | null>(null);

export function ScoresProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState<DayData[]>([]);
  const [scores, setScores] = useState<DailyScores[]>([]);
  const [logged, setLogged] = useState<Logged>(NOTHING_LOGGED);
  const [learnedNeed, setLearnedNeed] = useState<LearnedSleepNeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<HealthSource>(mockSource);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [dayBack, setDayBackRaw] = useState(0);
  const loadedAt = useRef(0);

  const refresh = useCallback(async () => {
    loadedAt.current = Date.now();
    setLoading(true);
    setError(null);
    try {
      const picked = await pickHealthSource();
      setSource(picked);
      const [fromSource, fromCoach] = await Promise.all([
        picked.getDays(HISTORY_DAYS),
        fetchLogged(new Date(Date.now() - HISTORY_DAYS * 86_400_000)).catch(() => NOTHING_LOGGED),
      ]);
      // Demo days bring their own workouts, and demo habits so the Habits screen has something to show.
      const mockHabits = picked.id === 'mock' ? generateMockHabits(fromSource).map((h, i) => ({ ...h, id: `mock-${i}`, occurredAt: Date.parse(`${h.date}T20:00:00`) })) : [];
      setLogged(picked.id === 'mock' ? { ...fromCoach, habits: [...fromCoach.habits, ...mockHabits] } : fromCoach);
      // Logged workouts count toward real days' strain.
      const loaded = picked.id === 'mock' ? fromSource : attachWorkouts(fromSource, fromCoach.workouts);
      setDays(loaded);
      // TODO(milestone 3): use the user's real age from their profile.
      // Score once with the default 8 h need, learn your own from the nights you recovered best
      // after, then score again with it.
      const first = computeDailyScores(loaded, MOCK_PROFILE);
      const learned = learnSleepNeed(first);
      setLearnedNeed(learned);
      const computed = learned ? computeDailyScores(loaded, { ...MOCK_PROFILE, baseSleepNeedMinutes: learned.minutes }) : first;
      setScores(computed);
      // Zones for live heart rate: the latest resting HR (or the median of the last week's).
      const rested = loaded.slice(-7).flatMap((d) => (d.restingHr ? [d.restingHr] : [])).sort((a, b) => a - b);
      const restingHr = loaded.at(-1)?.restingHr ?? rested[Math.floor(rested.length / 2)] ?? 60;
      setHeartRateBaseline(restingHr, estimateMaxHr(MOCK_PROFILE));
      // The home-screen widget shows the newest real reading when live heart rate isn't running.
      if (picked.id !== 'mock') publishLatestFromHistory(loaded.at(-1)?.heartRate ?? [], liveZone);
      // A failed upload shouldn't hide the scores, so it's reported separately.
      syncDailySummaries(picked.id, loaded, computed)
        .then((sent) => setSyncStatus(sent ? 'ok' : null))
        .catch((e) => setSyncStatus(e instanceof Error ? e.message : String(e)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - loadedAt.current > STALE_MS) {
        setDayBackRaw(0); // back after a while: start from today again
        refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  const syncNow = useCallback(async () => {
    try {
      const sent = await syncDailySummaries(source.id, days, scores);
      setSyncStatus(sent ? 'ok' : null);
    } catch (e) {
      setSyncStatus(e instanceof Error ? e.message : String(e));
    }
  }, [source, days, scores]);

  const metrics = useMemo(() => computeDayMetrics(days, scores, logged, MOCK_PROFILE), [days, scores, logged]);

  const setDayBack = useCallback(
    (back: number) => setDayBackRaw(Math.min(Math.max(back, 0), Math.max(scores.length - 1, 0))),
    [scores.length],
  );

  return (
    <ScoresContext.Provider
      value={{
        loading,
        error,
        sourceLabel: source.label,
        sourceId: source.id,
        getHeartRate: source.getHeartRate,
        days,
        scores,
        logged,
        metrics,
        learnedNeed,
        syncStatus,
        refresh,
        syncNow,
        dayBack: Math.min(dayBack, Math.max(scores.length - 1, 0)),
        setDayBack,
      }}>
      {children}
    </ScoresContext.Provider>
  );
}

export function useScores(): ScoresState {
  const value = useContext(ScoresContext);
  if (!value) throw new Error('useScores must be used inside ScoresProvider');
  return value;
}

/**
 * The day the screens are showing (see dayBack) and the one before it, for "yesterday's strain".
 * `days` and `scores` line up one-to-one, oldest first.
 */
export function useSelectedDay() {
  const { scores, days, dayBack, setDayBack } = useScores();
  const index = scores.length - 1 - dayBack;
  return {
    score: scores[index] as DailyScores | undefined,
    day: days[index] as DayData | undefined,
    previous: index > 0 ? scores[index - 1] : undefined,
    index,
    isLatest: dayBack === 0,
    dayBack,
    setDayBack,
    /** How many days there are to go back to. */
    count: scores.length,
  };
}
