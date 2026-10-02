import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, Input, Muted, Screen } from '@/components/ui';
import { setBackgroundStyle, useBackgroundStyle } from '@/lib/backgroundStyle';
import { colors, type } from '@/constants/theme';
import { useAuth } from '@/lib/AuthProvider';
import { useScores } from '@/lib/ScoresProvider';
import { supabase } from '@/lib/supabase';

/**
 * Sign in with an email code (no password), see what syncs, sign out. Signing in is optional:
 * scores work without it. It's needed for backup, and later for meal logging and the coach.
 */
export default function AccountScreen() {
  const background = useBackgroundStyle();
  const { enabled, session } = useAuth();
  const { sourceId, syncStatus, refresh } = useScores();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      const { error } = await supabase!.auth.signInWithOtp({ email: email.trim() });
      if (error) throw error;
      setCodeSent(true);
    });

  const verify = () =>
    run(async () => {
      const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
      if (error) throw error;
      setCode('');
      setCodeSent(false);
      await refresh(); // uploads today's summaries if real data is loaded
    });

  const signOut = () =>
    run(async () => {
      const { error } = await supabase!.auth.signOut();
      if (error) throw error;
    });

  return (
    <Screen back overline="ACCOUNT" title={session ? 'Signed in' : 'Sign in'}>
      {!enabled ? (
        <Card title="NOT SET UP YET">
          <Muted>
            This build isn&apos;t connected to a Supabase project, so there&apos;s nothing to sign in to. See
            docs/SETUP.md, &quot;Supabase&quot;.
          </Muted>
        </Card>
      ) : session ? (
        <>
          <Card title="YOUR ACCOUNT">
            <Text style={styles.email}>{session.user.email}</Text>
            <Button label="Sign out" onPress={signOut} disabled={busy} />
          </Card>
          <Card title="WHAT SYNCS">
            <Muted>
              One summary per day: resting heart rate, HRV, sleep times and your three scores with what drove them. Raw
              heart-rate samples stay on your phone, and demo data is never uploaded.
            </Muted>
            <Text style={styles.status}>
              {sourceId === 'mock'
                ? 'Nothing to sync yet: the app is showing demo data.'
                : syncStatus === 'ok'
                  ? 'Last 14 days synced.'
                  : syncStatus ?? 'Pull down on Today to sync.'}
            </Text>
          </Card>
        </>
      ) : (
        <Card title="EMAIL CODE">
          <Muted>
            {codeSent
              ? `We sent a code to ${email.trim()}. Enter it below.`
              : 'Enter your email and we’ll send you a one-time code. No password needed.'}
          </Muted>
          {codeSent ? (
            <Input
              value={code}
              onChangeText={setCode}
              placeholder="Code from the email"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={10}
            />
          ) : (
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
          )}
          {codeSent ? (
            <>
              <Button label="Sign in" onPress={verify} disabled={busy || code.trim().length < 6} />
              <Button label="Use a different email" onPress={() => setCodeSent(false)} disabled={busy} />
            </>
          ) : (
            <Button label="Send code" onPress={sendCode} disabled={busy || !email.includes('@')} />
          )}
        </Card>
      )}
      {message ? <Text style={styles.error}>{message}</Text> : null}
      <Card title="BACKGROUND">
        <View style={styles.chips}>
          <Chip label="Scenes" selected={background === 'scenes'} onPress={() => setBackgroundStyle('scenes')} />
          <Chip label="Aurora" selected={background === 'aurora'} onPress={() => setBackgroundStyle('aurora')} />
        </View>
        <Muted>
          {background === 'scenes'
            ? 'Mountain photos that follow the time of day: dawn, day, dusk and night.'
            : 'Soft moving lights in your score colors, shifting with the time of day.'}
        </Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8 },
  email: { ...type.title, color: colors.text },
  status: { ...type.caption, color: colors.text },
  error: { ...type.body, color: colors.recovery.red },
});
