import 'react-native-url-polyfill/auto';

import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform, TurboModuleRegistry } from 'react-native';

/**
 * The Supabase client, or null when the project isn't configured (no .env yet), so the app still
 * runs on its own. The URL and publishable key are public by design: Row Level Security in the
 * database is what keeps each user's rows private. Secret keys never go in the app.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Where the sign-in is kept between launches: AsyncStorage. Like Health Connect, AsyncStorage
 * throws as soon as it's imported if its native part isn't in the build (an APK built before it was
 * added), so it's only loaded when present. Without it the sign-in lasts until the app closes.
 */
function sessionStorage(): SessionStorage {
  if (TurboModuleRegistry.get('RNCAsyncStorage')) {
    return require('@react-native-async-storage/async-storage').default as SessionStorage;
  }
  const memory = new Map<string, string>();
  return {
    getItem: async (k) => memory.get(k) ?? null,
    setItem: async (k, v) => void memory.set(k, v),
    removeItem: async (k) => void memory.delete(k),
  };
}

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: Platform.OS === 'web' ? undefined : sessionStorage(),
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          lock: processLock,
        },
      })
    : null;

// Refresh the session only while the app is in the foreground, as Supabase recommends on mobile.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
