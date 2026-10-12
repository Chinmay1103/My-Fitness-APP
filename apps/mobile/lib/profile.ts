import { ageOn, MOCK_PROFILE, type Sex, type UserProfile } from '@fitness/scoring';

import { supabase } from './supabase';

/**
 * The user's profile as the coach recorded it (birth date, measured max heart rate, sex), turned
 * into what the scoring needs. Falls back to the demo profile (age 28) when signed out, offline or
 * not told yet; `ageKnown` says which.
 */
export async function fetchProfile(): Promise<UserProfile> {
  if (!supabase) return MOCK_PROFILE;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return MOCK_PROFILE;
  // '*' rather than a column list, so a column whose migration isn't pushed yet doesn't fail the read.
  const { data } = await supabase.from('profiles').select('*').maybeSingle();
  if (!data) return MOCK_PROFILE;
  const row = data as { birth_date?: string | null; max_hr?: number | null; sex?: string | null };
  const profile: UserProfile = { ...MOCK_PROFILE };
  if (row.birth_date) {
    const age = ageOn(row.birth_date, Date.now());
    if (age >= 10 && age <= 100) Object.assign(profile, { age, ageKnown: true });
  }
  if (row.max_hr) profile.maxHr = row.max_hr;
  if (row.sex === 'male' || row.sex === 'female') profile.sex = row.sex as Sex;
  return profile;
}
