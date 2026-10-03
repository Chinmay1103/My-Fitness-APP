import { heartRateZone, summarizeHeartRate } from '@fitness/scoring';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HeartRateChart, zoneColor, zoneName } from '@/components/charts/HeartRateChart';
import { Card, Muted, Row, Stat } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { formatTime } from '@/lib/format';
import { tapHaptic } from '@/lib/haptics';
import { ago, heartRateLimits, useDayHeartRate } from '@/lib/heartRate';
import { useScores } from '@/lib/ScoresProvider';

/** Today's heart rate at a glance: the latest reading, a mini chart of the day and low / avg / high. Opens the full screen. */
export function HeartRateCard({ date }: { date: string }) {
  const { days } = useScores();
  const { samples, day } = useDayHeartRate(date);
  const summary = summarizeHeartRate(samples);
  const { restingHr, maxHr } = heartRateLimits(days, date);

  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        router.push('/heart-rate');
      }}
      accessibilityRole="button"
      accessibilityLabel={summary ? `Heart rate, latest ${Math.round(summary.latest.bpm)} bpm. Open heart rate details.` : 'Heart rate. Open details.'}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card title="HEART RATE  ›">
        {summary ? (
          <>
            <View style={styles.top}>
              <View style={styles.latest}>
                <Text style={[styles.bpm, { color: zoneColor(heartRateZone(summary.latest.bpm, restingHr, maxHr)) }]}>
                  {Math.round(summary.latest.bpm)}
                </Text>
                <View>
                  <Text style={styles.unit}>bpm</Text>
                  <Text style={styles.when}>
                    {formatTime(summary.latest.time)} · {ago(summary.latest.time)}
                  </Text>
                  <Text style={styles.when}>{zoneName(heartRateZone(summary.latest.bpm, restingHr, maxHr))}</Text>
                </View>
              </View>
            </View>
            <HeartRateChart samples={samples} date={date} restingHr={restingHr} maxHr={maxHr} sleep={day?.sleep} compact />
            <Row>
              <Stat label="Low" value={`${summary.low}`} />
              <Stat label="Average" value={`${Math.round(summary.avg)}`} />
              <Stat label="High" value={`${summary.high}`} />
            </Row>
          </>
        ) : (
          <Muted>No heart rate today yet. Once the band syncs, readings show up here within a minute or two.</Muted>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  latest: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bpm: { fontFamily: fonts.number, fontSize: 44, fontVariant: ['tabular-nums'] },
  unit: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 13 },
  when: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12 },
});
