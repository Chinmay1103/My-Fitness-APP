import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Muted, Screen } from '@/components/ui';
import { colors, fonts, spacing, type } from '@/constants/theme';
import { checkDataTypes, CORE_TYPES, healthConnectSource, openHealthConnectSettings, type DataTypeCheck } from '@/lib/health';
import { useScores } from '@/lib/ScoresProvider';

const TYPE_LABELS: Record<string, string> = {
  HeartRate: 'Heart rate',
  RestingHeartRate: 'Resting heart rate',
  HeartRateVariabilityRmssd: 'HRV (RMSSD)',
  SleepSession: 'Sleep (with stages)',
  Steps: 'Steps',
  ExerciseSession: 'Workouts',
  ActiveCaloriesBurned: 'Active calories',
  TotalCaloriesBurned: 'Total calories',
  OxygenSaturation: 'Blood oxygen (SpO₂)',
  RespiratoryRate: 'Breathing rate',
  SkinTemperature: 'Skin temperature',
  Vo2Max: 'VO₂ max',
};

type Status = 'checking' | 'unavailable' | 'needs-permission' | 'connected';

/**
 * Where the app's data comes from, and what's actually in Health Connect. When the Fitbit Air
 * arrives this is the first screen to open: it lists which data types the band writes.
 */
export default function HealthScreen() {
  const { sourceLabel, sourceId, refresh } = useScores();
  const [status, setStatus] = useState<Status>('checking');
  const [checks, setChecks] = useState<DataTypeCheck[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      if (!(await healthConnectSource.isAvailable())) {
        setStatus('unavailable');
        return;
      }
      const allowed = await healthConnectSource.hasPermissions();
      setStatus(allowed ? 'connected' : 'needs-permission');
      // Types the user didn't allow show up as "not allowed" rather than failing the whole list.
      setChecks(await checkDataTypes(7));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const connect = async () => {
    setBusy(true);
    try {
      await healthConnectSource.requestPermissions();
    } finally {
      setBusy(false);
    }
    await load();
    await refresh(); // switches the scores to real data if the core reads were allowed
  };

  return (
    <Screen back overline="HEALTH DATA" title="Where your data comes from">
      <Card title="NOW SHOWING">
        <Text style={styles.source}>{sourceLabel}</Text>
        {status === 'checking' ? <ActivityIndicator color={colors.text} /> : null}
        {status === 'unavailable' ? (
          <Muted>
            Health Connect can&apos;t be reached from this version of the app, so you&apos;re seeing demo data. It works
            in the app&apos;s own build (not Expo Go), on Android with Health Connect installed.
          </Muted>
        ) : null}
        {status === 'needs-permission' ? (
          <>
            <Muted>
              Allow the app to read your heart rate, HRV and sleep from Health Connect to replace the demo data with your
              own. Nothing leaves your phone.
            </Muted>
            <Button label="Connect Health Connect" onPress={connect} disabled={busy} />
          </>
        ) : null}
        {status === 'connected' ? (
          <>
            <Muted>
              {sourceId === 'health-connect'
                ? 'Your scores come from Health Connect. Pull down on any screen to refresh.'
                : 'Connected. Pull down on Today to load your data.'}
            </Muted>
            <Button label="Allow more data types" onPress={connect} disabled={busy} />
            <Button label="Open Health Connect settings" onPress={openHealthConnectSettings} disabled={busy} />
          </>
        ) : null}
      </Card>

      {checks ? (
        <Card title="IN HEALTH CONNECT, LAST 7 DAYS">
          <Muted>Which data types exist and which app wrote them. Scores need the four marked &quot;scores&quot;.</Muted>
          {checks.map((c) => (
            <View key={c.type} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>
                  {TYPE_LABELS[c.type] ?? c.type}
                  {(CORE_TYPES as readonly string[]).includes(c.type) ? <Text style={styles.core}>  · scores</Text> : null}
                </Text>
                <Text style={styles.rowDetail}>{describe(c)}</Text>
              </View>
              <Text style={[styles.count, { color: c.count > 0 ? colors.recovery.green : colors.muted }]}>
                {c.error ? '–' : c.count}
              </Text>
            </View>
          ))}
          <Button label={busy ? 'Checking…' : 'Check again'} onPress={load} disabled={busy} />
        </Card>
      ) : null}
    </Screen>
  );
}

function describe(c: DataTypeCheck): string {
  if (c.error) return 'Not allowed yet';
  if (c.count === 0) return 'No records';
  const from = c.origins.join(', ') || 'unknown app';
  return c.latest ? `${from} · latest ${new Date(c.latest).toLocaleString()}` : from;
}

const styles = StyleSheet.create({
  source: { ...type.title, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  core: { ...type.caption, color: colors.muted },
  rowDetail: { ...type.caption, color: colors.muted },
  count: { fontFamily: fonts.number, fontSize: 20, minWidth: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
