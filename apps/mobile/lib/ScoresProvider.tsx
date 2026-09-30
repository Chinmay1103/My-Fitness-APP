import { computeDailyScores, MOCK_PROFILE, type DailyScores, type DayData } from '@fitness/scoring';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { mockSource } from './health/mockSource';
import { pickHealthSource, type HealthSource } from './health';
import { syncDailySummaries } from './sync';

const HISTORY_DAYS = 45;

interface ScoresState {
  loading: boolean;
  error: string | null;
  sourceLabel: string;
  sourceId: HealthSource['id'];
  days: DayData[];
  scores: DailyScores[];
  /** Result of the last upload to Supabase: 'ok', an error message, or null if nothing was sent. */
  syncStatus: string | null;
  refresh: () => Promise<void>;
}

const ScoresContext = createContext<ScoresState | null>(null);

export function ScoresProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState<DayData[]>([]);
  const [scores, setScores] = useState<DailyScores[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<HealthSource>(mockSource);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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
  }, [refresh]);

  return (
    <ScoresContext.Provider
      value={{ loading, error, sourceLabel: source.label, sourceId: source.id, days, scores, syncStatus, refresh }}>
      {children}
    </ScoresContext.Provider>
  );
}

export function useScores(): ScoresState {
  const value = useContext(ScoresContext);
  if (!value) throw new Error('useScores must be used inside ScoresProvider');
  return value;
}
