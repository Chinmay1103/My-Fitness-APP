import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button, Card, Muted } from '@/components/ui';
import { type } from '@/constants/theme';
import { isMorningSummaryOn, isMorningSummarySupported, sendMorningSummary, setMorningSummary } from '@/lib/morningSummary';
import { makeStyles } from '@/lib/theme';

/** Account screen: switch the morning notification on or off, and send one now to see it. */
export function MorningSummaryCard() {
  const styles = useStyles();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supported = isMorningSummarySupported();

  useEffect(() => {
    isMorningSummaryOn().then(setOn);
  }, []);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="MORNING SUMMARY">
      <Muted>
        One notification each morning, once last night’s sleep has synced: your recovery, how hard to go today and when to be in
        bed tonight. Android decides the exact time, usually within half an hour of the data arriving.
      </Muted>
      {supported ? (
        <>
          <Button
            label={on ? 'Turn off' : 'Turn on'}
            variant={on ? 'secondary' : 'primary'}
            disabled={busy}
            onPress={() =>
              run(async () => {
                const error = await setMorningSummary(!on);
                setOn(await isMorningSummaryOn());
                return error;
              })
            }
          />
          <Button label={busy ? 'Working…' : 'Send one now'} variant="secondary" disabled={busy} onPress={() => run(() => sendMorningSummary(true))} />
        </>
      ) : (
        <Muted>Needs the next app build.</Muted>
      )}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </Card>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  message: { ...type.body, color: colors.text },
}));
