import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from './AuthProvider';
import { supabase } from './supabase';

/** Claude's weekly report, written through the coach connector (save_weekly_report). */
export interface WeeklyReport {
  weekEnd: string;
  headline: string;
  summary: string;
  focus: string;
  updatedAt: string;
}

/** The newest report for a week ending between `from` and `to` (YYYY-MM-DD), or null. */
export function useWeeklyReport(from: string | undefined, to: string | undefined): WeeklyReport | null {
  const { session } = useAuth();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const userId = session?.user.id;

  useFocusEffect(
    useCallback(() => {
      if (!supabase || !userId || !from || !to) {
        setReport(null);
        return;
      }
      supabase
        .from('weekly_reports')
        .select('week_end, headline, summary, focus, updated_at')
        .gte('week_end', from)
        .lte('week_end', to)
        .order('week_end', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) return;
          setReport(data ? { weekEnd: data.week_end, headline: data.headline, summary: data.summary, focus: data.focus, updatedAt: data.updated_at } : null);
        });
    }, [userId, from, to]),
  );

  return report;
}
