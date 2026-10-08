import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, Input, Muted } from '@/components/ui';
import { colors, type } from '@/constants/theme';
import { formatTime } from '@/lib/format';
import {
  pickAlertContact,
  reached,
  sendTestAlert,
  setAlertEnabled,
  setAlertThreshold,
  setWhatsappKey,
  SUSTAIN_TEXT,
  THRESHOLDS,
  useHeartRateAlert,
} from '@/lib/heartRateAlert';

/** "SMS sent · WhatsApp failed: …" for one send. */
function describeResult(r: { sms?: string | null; whatsapp?: string | null }): string {
  const part = (name: string, v: string | null | undefined) =>
    v === undefined ? null : v === null ? `${name} sent` : `${name} failed (${v})`;
  return [part('SMS', r.sms), part('WhatsApp', r.whatsapp)].filter(Boolean).join(' · ');
}

/** Live screen card: who gets messaged, at what heart rate, on/off, WhatsApp setup and a test. */
export function HeartRateAlertCard() {
  const alert = useHeartRateAlert();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(alert.whatsappKey ?? '');
  useEffect(() => setKey(alert.whatsappKey ?? ''), [alert.whatsappKey]);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="HEART-RATE ALERT">
      <Muted>
        If your heart rate stays at or above your limit for {SUSTAIN_TEXT} while live heart rate is running, your phone sends
        this contact an SMS and a WhatsApp message. At most one alert every 30 minutes.
      </Muted>

      <View style={styles.row}>
        <Text style={styles.label}>Contact</Text>
        <Text style={styles.value} numberOfLines={1}>
          {alert.contact ? `${alert.contact.name} · ${alert.contact.phone}` : 'None yet'}
        </Text>
      </View>
      <Button
        label={alert.contact ? 'Change contact' : 'Pick a contact'}
        variant="secondary"
        disabled={busy}
        onPress={() => run(pickAlertContact)}
      />

      <Text style={styles.label}>Alert when it stays above</Text>
      <View style={styles.chips}>
        {THRESHOLDS.map((t) => (
          <Chip key={t} label={`${t} bpm`} selected={alert.thresholdBpm === t} onPress={() => setAlertThreshold(t)} />
        ))}
      </View>

      {alert.contact ? (
        <>
          <Text style={styles.label}>WhatsApp (via CallMeBot)</Text>
          <Muted>
            Once, on {alert.contact.name.split(' ')[0]}&apos;s phone: save CallMeBot&apos;s WhatsApp number (shown on
            callmebot.com) and send it &quot;I allow callmebot to send me messages&quot;. CallMeBot replies with a key;
            type it here. Alerts then come from CallMeBot&apos;s number.
          </Muted>
          <Input
            value={key}
            onChangeText={setKey}
            onEndEditing={() => setWhatsappKey(key)}
            onSubmitEditing={() => setWhatsappKey(key)}
            placeholder="CallMeBot key, e.g. 123456"
            keyboardType="number-pad"
            autoCapitalize="none"
          />
          <Button
            label="Open callmebot.com"
            variant="secondary"
            onPress={() => Linking.openURL('https://www.callmebot.com/blog/free-api-whatsapp-messages/')}
          />
        </>
      ) : null}

      <Button
        label={alert.enabled ? 'Turn alert off' : 'Turn alert on'}
        variant={alert.enabled ? 'secondary' : 'primary'}
        disabled={busy}
        onPress={() => {
          setWhatsappKey(key);
          run(() => setAlertEnabled(!alert.enabled));
        }}
      />
      {alert.contact ? (
        <Button
          label="Send a test message"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setWhatsappKey(key);
            run(async () => {
              const result = await sendTestAlert();
              return `${reached(result) ? 'Test: ' : 'Test didn’t go out: '}${describeResult(result)}`;
            });
          }}
        />
      ) : null}

      <Text style={[styles.status, { color: alert.enabled ? colors.recovery.green : colors.muted }]}>
        {alert.enabled
          ? `On: above ${alert.thresholdBpm} bpm for ${SUSTAIN_TEXT} · SMS${alert.whatsappKey ? ' + WhatsApp' : ''}`
          : 'Off'}
      </Text>
      {alert.last && !alert.last.test ? (
        <Muted>{`Last alert ${formatTime(alert.last.time)} (${alert.last.bpm} bpm): ${describeResult(alert.last)}`}</Muted>
      ) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Muted>
        Workouts push heart rate past 110 too: turn the alert off before exercising, or pick a higher limit. This is a
        wellness alert, not a medical device; in an emergency call 112.
      </Muted>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { ...type.caption, color: colors.muted },
  value: { ...type.bodyStrong, color: colors.text, flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  status: { ...type.bodyStrong },
  message: { ...type.body, color: colors.text },
});
