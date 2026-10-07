import { computeStrain, MOCK_PROFILE } from '@fitness/scoring';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HeartRateAlertCard } from '@/components/HeartRateAlertCard';
import { LiveHeartChart } from '@/components/charts/LiveHeartChart';
import { Button, Card, Muted, Row, Screen, Stat } from '@/components/ui';
import { colors, fonts, type } from '@/constants/theme';
import { formatMinutes } from '@/lib/format';
import { isAlertSupported } from '@/lib/heartRateAlert';
import { isWidgetSupported, pinHeartRateWidget } from '@/lib/heartRateWidget';
import {
  getHeartRateBaseline,
  isLiveHeartRateSupported,
  liveZone,
  startLiveHeartRate,
  stopLiveHeartRate,
  useLiveHeartRate,
  zoneName,
  type LiveStatus,
} from '@/lib/liveHeartRate';

const STATUS_TEXT: Record<LiveStatus, string> = {
  off: 'Not running',
  searching: 'Looking for your band…',
  connecting: 'Connecting…',
  live: 'Live',
  reconnecting: 'Lost the band, reconnecting…',
  error: 'Stopped',
};

/**
 * Live heart rate from the band, about once a second, with the last few minutes as a graph.
 * Opened from Today, from the notification while it runs, and from the home-screen widget.
 */
export default function LiveScreen() {
  const live = useLiveHeartRate();
  const [widgetMessage, setWidgetMessage] = useState<string | null>(null);
  const supported = isLiveHeartRateSupported();
  const { restingHr, maxHr } = getHeartRateBaseline();

  const latest = live.samples.at(-1);
  const running = live.status !== 'off' && live.status !== 'error';
  const fresh = !!latest && live.status === 'live' && Date.now() - latest.time < 10_000;
  const zone = latest ? liveZone(latest.bpm) : 0;
  const color = fresh ? (zone === 0 ? colors.text : colors.hrZones[zone - 1]) : colors.muted;

  const first = live.samples[0];
  const sessionMinutes = first && latest ? (latest.time - first.time) / 60_000 : 0;
  const values = live.samples.map((s) => s.bpm);
  const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  const strain = live.samples.length > 1 ? computeStrain(live.samples, restingHr, MOCK_PROFILE).strain : 0;

  const addWidget = async () => {
    const asked = await pinHeartRateWidget();
    setWidgetMessage(
      asked
        ? 'Check your home screen: your phone asks where to put it.'
        : 'Your launcher can’t add it from here. Long-press the home screen › Widgets › My Fitness › Heart rate.',
    );
  };

  return (
    <Screen back overline="LIVE" title="Heart rate" glow={colors.restingHr}>
      {!supported ? (
        <Card title="NEEDS THE NEW BUILD">
          <Muted>
            Live heart rate uses Bluetooth, which this version of the app doesn&apos;t include (Expo Go or a build made
            before Oct 6). Install the new development build (docs/SETUP.md) to use it.
          </Muted>
        </Card>
      ) : (
        <>
          <Card>
            <View style={styles.hero}>
              <View style={styles.bpmRow} accessibilityLiveRegion="polite">
                <Text style={[styles.bpm, { color }]}>{latest ? latest.bpm : '--'}</Text>
                <Text style={styles.unit}>bpm</Text>
              </View>
              <Text style={[styles.zone, { color }]}>{latest ? zoneName(zone) : ' '}</Text>
              <Text style={styles.status}>
                {live.status === 'live' && live.deviceName ? `Live from ${live.deviceName}` : STATUS_TEXT[live.status]}
              </Text>
            </View>
            {live.message ? <Text style={styles.error}>{live.message}</Text> : null}
            {running ? (
              <Button label="Stop" variant="secondary" onPress={stopLiveHeartRate} />
            ) : (
              <Button label={live.samples.length ? 'Start again' : 'Start live heart rate'} onPress={startLiveHeartRate} />
            )}
          </Card>

          {live.samples.length > 0 ? (
            <Card title="LAST FEW MINUTES">
              <LiveHeartChart samples={live.samples} restingHr={restingHr} maxHr={maxHr} />
            </Card>
          ) : null}

          {live.samples.length > 1 ? (
            <Card title="THIS SESSION">
              <Row>
                <Stat label="Time" value={formatMinutes(sessionMinutes)} />
                <Stat label="Avg bpm" value={avg != null ? String(avg) : '--'} />
                <Stat label="Peak bpm" value={String(Math.max(...values))} />
                <Stat label="Strain" value={strain.toFixed(1)} color={colors.strain} />
              </Row>
              <Muted>
                Strain here is just this session, worked out the same way as your day strain. Your day strain still comes
                from Health Connect after the band syncs.
              </Muted>
            </Card>
          ) : null}

          {isAlertSupported() ? <HeartRateAlertCard /> : null}

          {isWidgetSupported() ? (
            <Card title="HOME-SCREEN WIDGET">
              <Muted>
                Shows your heart rate and the last 30 minutes on your home screen. While live heart rate runs it updates
                every few seconds; otherwise it shows the latest reading from Health Connect.
              </Muted>
              <Button label="Add widget to home screen" variant="secondary" onPress={addWidget} />
              {widgetMessage ? <Muted>{widgetMessage}</Muted> : null}
            </Card>
          ) : null}

          <Card title="FIRST TIME">
            <Muted>
              1. In the Google Health app open Fitbit Air › Share heart rate and turn it on.{'\n'}
              2. Tap Start here and keep the band near your phone.{'\n'}
              3. A notification shows your heart rate while it runs; tap Stop when you&apos;re done, since sharing uses
              more of the band&apos;s battery.
            </Muted>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 2 },
  bpmRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bpm: { fontFamily: fonts.number, fontSize: 84, lineHeight: 92, fontVariant: ['tabular-nums'] },
  unit: { ...type.bodyStrong, color: colors.muted },
  zone: { fontFamily: fonts.bodySemi, fontSize: 16 },
  status: { ...type.caption, color: colors.muted },
  error: { ...type.body, color: colors.recovery.red },
});
