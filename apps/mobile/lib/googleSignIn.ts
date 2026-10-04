import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';

import { supabase } from './supabase';

/**
 * "Continue with Google" through Supabase Auth: Google's page opens in a browser tab, Supabase sends
 * the browser back to this app's link with a one-time code, and the app trades the code for a
 * session (PKCE, so the code is useless to anyone else). The session is then saved like an email
 * sign-in, so it lasts until Sign out.
 *
 * Needs Google turned on in the Supabase dashboard and REDIRECT_URL in its redirect allow-list
 * (docs/SETUP.md, "Google sign-in"). Until then the button stays hidden, see useGoogleEnabled.
 */
export const REDIRECT_URL = 'myfitness://auth-callback';

const handledCodes = new Set<string>();

/**
 * Finishes a sign-in from the link Supabase redirected to. Called both by signInWithGoogle and by
 * the auth-callback screen (Android may also open the app on the link), so each code is used once.
 */
export async function completeGoogleSignIn(url: string): Promise<void> {
  const params = new URL(url).searchParams;
  const error = params.get('error_description') ?? params.get('error');
  if (error) throw new Error(error);
  const code = params.get('code');
  if (!code || handledCodes.has(code)) return;
  handledCodes.add(code);
  const { error: exchangeError } = await supabase!.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}

export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase!.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);
  if (result.type === 'success') await completeGoogleSignIn(result.url);
}

/** Whether Google sign-in is turned on in the Supabase project (asked once per app launch). */
let enabledCache: Promise<boolean> | null = null;

function fetchGoogleEnabled(): Promise<boolean> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !key) return Promise.resolve(false);
  return fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    .then((r) => r.json())
    .then((s: { external?: { google?: boolean } }) => !!s.external?.google)
    .catch(() => {
      enabledCache = null; // offline: ask again next time
      return false;
    });
}

export function useGoogleEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    enabledCache ??= fetchGoogleEnabled();
    enabledCache.then((v) => live && setEnabled(v));
    return () => {
      live = false;
    };
  }, []);
  return enabled;
}
