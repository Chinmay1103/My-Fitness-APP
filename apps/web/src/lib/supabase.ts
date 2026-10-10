import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Same Supabase project as the phone app. The URL and publishable key are public by design (they
 * are also in docs/oauth/consent.html): Row Level Security keeps each user's rows private.
 * VITE_SUPABASE_URL / VITE_SUPABASE_KEY in apps/web/.env override them, e.g. for a test project.
 */
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://uhbgogzfelkbnrqthutg.supabase.co';
const key = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_5yQ-GE5Khfevm0K2lSIo5Q_GjzFggQp';

export const supabase: SupabaseClient = createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Whether Google sign-in is switched on in Supabase (the button only shows then, as on the phone). */
export function googleEnabled(): Promise<boolean> {
  return fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    .then((r) => r.json())
    .then((s: { external?: { google?: boolean } }) => !!s.external?.google)
    .catch(() => false);
}
