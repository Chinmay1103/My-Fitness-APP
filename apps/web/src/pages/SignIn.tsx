import { useEffect, useState, type FormEvent } from 'react';

import { googleEnabled, supabase } from '../lib/supabase';

/** Same account as the phone: an email code, or Google when it's switched on in Supabase. */
export function SignIn({ onDemo }: { onDemo: () => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [google, setGoogle] = useState(false);

  useEffect(() => {
    googleEnabled().then(setGoogle);
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      // shouldCreateUser: false — the website is for an account made on the phone.
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
      if (error) throw error;
      setSent(true);
    });
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
      if (error) throw error;
    });
  };

  const withGoogle = () =>
    run(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
    });

  return (
    <main className="signin">
      <img src="./icon-192.png" alt="" width={72} height={72} className="logo-big" />
      <h1>My Fitness</h1>
      <p className="muted">Your recovery, strain and sleep over months, not just the phone's last 30 days. Sign in with the account you use on the phone.</p>

      {!sent ? (
        <form onSubmit={sendCode} className="form">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" />
          <button type="submit" className="button primary" disabled={busy || !email.trim()}>
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="form">
          <label htmlFor="code">Code from the email to {email}</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
          <button type="submit" className="button primary" disabled={busy || !code.trim()}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" className="link" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </form>
      )}

      {google ? (
        <button type="button" className="button" onClick={withGoogle} disabled={busy}>
          Continue with Google
        </button>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error.includes('Signups not allowed') ? 'No account with that email yet. Sign up in the phone app first.' : error}
        </p>
      ) : null}

      <div className="divider" />
      <button type="button" className="link" onClick={onDemo}>
        Look around with demo data first ›
      </button>
    </main>
  );
}
