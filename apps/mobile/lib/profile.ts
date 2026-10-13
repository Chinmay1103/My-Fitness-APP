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
  const row = data as ProfileRow;
  const profile: UserProfile = { ...MOCK_PROFILE };
  if (row.birth_date) {
    const age = ageOn(row.birth_date, Date.now());
    if (age >= 10 && age <= 100) Object.assign(profile, { age, ageKnown: true });
  }
  if (row.max_hr) profile.maxHr = row.max_hr;
  if (row.sex === 'male' || row.sex === 'female') profile.sex = row.sex as Sex;
  if (row.height_cm) profile.heightCm = row.height_cm;
  if (row.protein_target_g) profile.proteinTargetG = row.protein_target_g;
  if (row.calorie_target) profile.calorieTarget = row.calorie_target;
  return profile;
}

/** The profile fields the Account screen edits. */
export interface ProfileRow {
  birth_date?: string | null;
  max_hr?: number | null;
  sex?: string | null;
  height_cm?: number | null;
  protein_target_g?: number | null;
  calorie_target?: number | null;
}

/** The signed-in user's profile row, or null when signed out. */
export async function fetchProfileRow(): Promise<ProfileRow | null> {
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;
  const { data } = await supabase.from('profiles').select('*').maybeSingle();
  return (data as ProfileRow | null) ?? {};
}

/** Saves birth date, sex and height. Throws with a readable message on failure. */
export async function saveProfile(fields: { birth_date: string | null; sex: 'male' | 'female' | null; height_cm: number | null }) {
  if (!supabase) throw new Error('Not connected to Supabase.');
  const { data: session } = await supabase.auth.getSession();
  const id = session.session?.user.id;
  if (!id) throw new Error('Sign in first.');
  const { error } = await supabase.from('profiles').update(fields).eq('id', id);
  if (error) {
    if (error.message.includes('height_cm') || error.message.includes('sex')) {
      throw new Error('The database needs the latest update first (npm run db:push).');
    }
    throw new Error(error.message);
  }
}
