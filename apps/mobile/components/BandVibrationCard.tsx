import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button, Card, Muted } from '@/components/ui';
import { type } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { inspectBand, testBandBuzz, type BandReport } from '@/lib/liveHeartRate';

/**
 * One-off check: can the app make the band vibrate (for calls, or the heart-rate alert)?
 * Lists the band's Bluetooth services and tries the two standard alert ones.
 */
export function BandVibrationCard({ connected }: { connected: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  const [report, setReport] = useState<BandReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } catch (e) {
      setMessage(`Something went wrong: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const check = () =>
    run(async () => {
      const r = await inspectBand();
      setReport(r);
      setMessage(r ? null : 'Start live heart rate first, so the app is connected to the band.');
    });
  const buzz = () => run(async () => setMessage(await testBandBuzz()));

  return (
    <Card title="BAND VIBRATION TEST">
      <Muted>
        Checks whether the app can make the band buzz, for calls or the heart-rate alert. Start live heart rate first.
      </Muted>
      <Button label="Check what the band offers" variant="secondary" onPress={check} disabled={!connected || busy} />
      {report ? (
        <>
          <Text style={[styles.verdict, { color: report.canVibrate ? colors.recovery.green : colors.recovery.red }]}>
            {report.canVibrate
              ? 'Good news: the band has a standard alert service. Tap Test buzz.'
              : 'No standard alert service, so the app probably can’t make it vibrate.'}
          </Text>
          {report.services.map((s) => (
            <Text key={s.uuid} style={styles.line} selectable>
              {s.name} ({s.uuid}){'\n'}
              {'   '}
              {s.characteristics.join(', ') || 'nothing inside'}
            </Text>
          ))}
          <Button label="Test buzz" onPress={buzz} disabled={!connected || busy} />
        </>
      ) : null}
      {message ? <Muted>{message}</Muted> : null}
    </Card>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  verdict: { ...type.bodyStrong },
  line: { ...type.caption, color: colors.muted },
}));
