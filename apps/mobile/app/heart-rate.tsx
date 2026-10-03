import { daySamples, summarizeHeartRate } from '@fitness/scoring';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HeartRateChart } from '@/components/charts/HeartRateChart';
import { LineChart } from '@/components/charts/LineChart';
import { dayName } from '@/components/charts/parts';
import { Card, Muted, Row, Screen, Stat } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { formatTime } from '@/lib/format';
import { tapHaptic } from '@/lib/haptics';
import { ago, heartRateLimits, useDayHeartRate } from '@/lib/heartRate';
import { useScores } from '@/lib/ScoresProvider';

export default function HeartRateScreen() {
  const { days, sourceId } = useScores();
  // Days back from today: 0 = today.
  const [back, setBack] = useState(0);
  const index = Math.max(days.length - 1 - back, 0);
  const date = days[index]?.date;
  const { samples, checkedAt, isToday, day } = useDayHeartRate(date);
  const summary = summarizeHeartRate(samples);
  const { restingHr, maxHr } = heartRateLimits(days, date);
  const dailyAverages = useMemo(
    () => days.slice(-30).map((d) => ({ date: d.date, value: summarizeHeartRate(daySamples(d))?.avg ?? null })),
    [days],
  );

  const step = (delta: number) => {
    const next = Math.min(Math.max(back + delta, 0), days.length - 1);
    if (next === back) return;
    tapHaptic();
    setBack(next);
  };

  return (
    <Screen back overline="HEART RATE" title={date ? dayName(date, isToday) : 'Heart rate'} glow={colors.restingHr}>
      <View style={styles.stepper}>
        <StepButton icon="left" label="Previous day" disabled={back >= days.length - 1} onPress={() => step(1)} />
        <Text style={styles.stepperText}>
          {isToday ? (checkedAt ? `Checked ${ago(checkedAt)} · updates every minute` : 'Updates every minute') : 'Whole day'}
        </Text>
        <StepButton icon="right" label="Next day" disabled={back === 0} onPress={() => step(-1)} />
      </View>

      <Card>
        {date ? <HeartRateChart samples={samples} date={date} restingHr={restingHr} maxHr={maxHr} sleep={day?.sleep} /> : null}
      </Card>

      {summary ? (
        <Card title="THE DAY IN NUMBERS">
          <Row>
            <Stat label="Low" value={`${summary.low} bpm`} />
            <Stat label="Average" value={`${Math.round(summary.avg)} bpm`} />
            <Stat label="High" value={`${summary.high} bpm`} />
          </Row>
          <Row>
            <Stat label="Resting" value={day?.restingHr ? `${day.restingHr} bpm` : '--'} hint="from last night" />
            <Stat label="Latest" value={formatTime(summary.latest.time)} hint={isToday ? ago(summary.latest.time) : undefined} />
            <Stat label="Tracked" value={`${Math.round((summary.minutesCovered / 60) * 10) / 10} h`} hint="hours with readings" />
          </Row>
        </Card>
      ) : null}

      <Card title="DAILY AVERAGE, LAST 30 DAYS">
        <LineChart
          label="Average heart rate"
          points={dailyAverages}
          color={colors.restingHr}
          format={(v) => `${Math.round(v)} bpm`}
          higherIsBetter={false}
        />
      </Card>

      <Card title="HOW FRESH IS THIS?">
        <Muted>
          The band sends readings to the Google Health app, which passes them to Health Connect in batches, so the newest
          reading can be a few minutes old. While this screen or Today is open, the app checks for new readings every
          minute. Colors are the same heart-rate zones the strain score uses.
          {sourceId === 'mock' ? ' You are looking at demo data.' : ''}
        </Muted>
      </Card>
    </Screen>
  );
}

function StepButton({ icon, label, disabled, onPress }: { icon: 'left' | 'right'; label: string; disabled: boolean; onPress: () => void }) {
  const name =
    icon === 'left'
      ? ({ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' } as const)
      : ({ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' } as const);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={10}
      style={({ pressed }) => [styles.stepButton, (disabled || pressed) && styles.dim]}>
      <SymbolView name={name} tintColor={colors.text} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stepperText: { flex: 1, textAlign: 'center', color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  stepButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.35 },
});
