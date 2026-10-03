import { computeDailyScores, MOCK_PROFILE, type DailyScores, type DayData } from '@fitness/scoring';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { mockSource } from './health/mockSource';
import { pickHealthSource, type HealthSource } from './health';
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
  /** Result of the last upload to Supabase: 'ok', an error message, or null if nothing was sent. */
  syncStatus: string | null;
  refresh: () => Promise<void>;
  /** Uploads the current scores again, so the coach connector sees the latest numbers. */
  syncNow: () => Promise<void>;
}

const ScoresContext = createContext<ScoresState | null>(null);

export function ScoresProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState<DayData[]>([]);
  const [scores, setScores] = useState<DailyScores[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<HealthSource>(mockSource);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const loadedAt = useRef(0);

  const refresh = useCallback(async () => {
    loadedAt.current = Date.now();
    setLoading(true);
    setError(null);
    try {
      const picked = await pickHealthSource();
      setSource(picked);
      const loaded = await picked.getDays(HISTORY_DAYS);
      setDays(loaded);
      // TODO(milestone 3): use the user's real age and sleep need from their profile.
      const computed = computeDailyScores(loaded, MOCK_PROFILE);
      setScores(computed);
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
      if (state === 'active' && Date.now() - loadedAt.current > STALE_MS) refresh();
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

  return (
    <ScoresContext.Provider
      value={{ loading, error, sourceLabel: source.label, sourceId: source.id, getHeartRate: source.getHeartRate, days, scores, syncStatus, refresh, syncNow }}>
      {children}
    </ScoresContext.Provider>
  );
}

export function useScores(): ScoresState {
  const value = useContext(ScoresContext);
  if (!value) throw new Error('useScores must be used inside ScoresProvider');
  return value;
}
