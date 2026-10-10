import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from './AuthProvider';
import { supabase } from './supabase';

/**
 * Claude's note for a day: the band's scores and what the user logged in the chat (workouts,
 * meals), joined into "why" and "what to do". Claude writes it through the coach connector's
 * save_daily_note tool (supabase/functions/mcp); the app only shows it.
 */
export interface CoachNote {
  date: string;
  headline: string;
  why: string;
  tips: string[];
  updatedAt: string;
}

/**
 * The signed-in user's latest note on or before `date` (so this morning, before Claude has written
 * today's, you still see yesterday's), or null. Reloads when the screen comes into focus and when
 * the app returns to the foreground, which is when the user comes back from the Claude app.
 */
export function useCoachNote(date: string | undefined): CoachNote | null {
  const { session } = useAuth();
  const [note, setNote] = useState<CoachNote | null>(null);
  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!supabase || !userId || !date) {
      setNote(null);
      return;
    }
    const { data, error } = await supabase
      .from('daily_notes')
      .select('date, headline, why, tips, updated_at')
      .lte('date', date)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    // A failed fetch keeps whatever note is already showing; the note is a bonus, not core data.
    if (error) return;
    setNote(data ? { date: data.date, headline: data.headline, why: data.why, tips: data.tips ?? [], updatedAt: data.updated_at } : null);
  }, [userId, date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => subscription.remove();
  }, [load]);

  return note;
}
