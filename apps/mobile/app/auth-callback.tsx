import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { completeGoogleSignIn, REDIRECT_URL } from '@/lib/googleSignIn';

/**
 * Where Google sign-in lands when Android opens the app on its return link (myfitness://auth-callback)
 * instead of handing it to the browser tab. Finishes the sign-in, then goes to the Account screen.
 */
export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === 'string') query.set(k, v);
    completeGoogleSignIn(`${REDIRECT_URL}?${query}`)
      .catch(() => {}) // the Account screen shows errors from its own attempt
      .finally(() => setDone(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return done ? <Redirect href="/account" /> : null;
}
