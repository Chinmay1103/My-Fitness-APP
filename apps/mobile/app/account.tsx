import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MorningSummaryCard } from '@/components/MorningSummaryCard';
import { Button, Card, Chip, Input, Muted, Screen } from '@/components/ui';
import { setBackgroundStyle, useBackgroundStyle } from '@/lib/backgroundStyle';
import { type } from '@/constants/theme';
import { makeStyles, useColors, useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/AuthProvider';
import { signInWithGoogle, useGoogleEnabled } from '@/lib/googleSignIn';
import { useScores } from '@/lib/ScoresProvider';
import { supabase } from '@/lib/supabase';

/**
 * Sign in with Google or an email code (no password), see what syncs, sign out. The sign-in stays
 * saved on the phone until Sign out. Signing in is optional: scores work without it. It's needed for backup, and later for meal logging and the coach.
 */
export default function AccountScreen() {
  const styles = useStyles();
  const background = useBackgroundStyle();
  const { preference, setPreference } = useTheme();
  const colors = useColors();
  const { enabled, session } = useAuth();
  const { sourceId, syncStatus, refresh } = useScores();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const googleEnabled = useGoogleEnabled();

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

  const google = () =>
    run(async () => {
      await signInWithGoogle();
      await refresh();
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
        <>
          {googleEnabled && !codeSent ? (
            <Card title="GOOGLE">
              <Button label="Continue with Google" onPress={google} disabled={busy} />
            </Card>
          ) : null}
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
        </>
      )}
      {message ? <Text style={styles.error}>{message}</Text> : null}
      <MorningSummaryCard />
      <Card title="APPEARANCE">
        <View style={styles.chips}>
          <Chip label="System" selected={preference === 'system'} onPress={() => setPreference('system')} />
          <Chip label="Light" selected={preference === 'light'} onPress={() => setPreference('light')} />
          <Chip label="Dark" selected={preference === 'dark'} onPress={() => setPreference('dark')} />
        </View>
        <Muted>
          {preference === 'system' ? 'Follows your phone’s light or dark setting.' : `Always ${preference}, whatever the phone is set to.`}
        </Muted>
      </Card>
      <Card title="BACKGROUND">
        <View style={styles.chips}>
          <Chip label="Scenes" selected={background === 'scenes'} onPress={() => setBackgroundStyle('scenes')} />
          <Chip label="Aurora" selected={background === 'aurora'} onPress={() => setBackgroundStyle('aurora')} />
          <Chip label="Plain" selected={background === 'plain'} onPress={() => setBackgroundStyle('plain')} />
        </View>
        <Muted>
          {background === 'scenes'
            ? `Photos that follow the time of day: dawn, day, dusk and night.${colors.scheme === 'light' ? ' They show in dark mode only; in light mode you get Plain.' : ''}`
            : background === 'aurora'
              ? 'Soft moving lights in your score colors, shifting with the time of day.'
              : 'A still page with a soft wash of each screen’s color at the top. Calmest, and easiest on the battery.'}
        </Muted>
      </Card>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8 },
  email: { ...type.title, color: colors.text },
  status: { ...type.caption, color: colors.text },
  error: { ...type.body, color: colors.recovery.red },
}));
