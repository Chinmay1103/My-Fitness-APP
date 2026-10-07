import { CALIBRATED_DAYS } from '@fitness/scoring';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CoachNoteCard } from '@/components/CoachNoteCard';
import { HeartRateCard } from '@/components/HeartRateCard';
import { ScoreRing } from '@/components/ScoreRing';
import { DayPager } from '@/components/Swipe';
import { TrendBars } from '@/components/TrendBars';
import { Card, Muted, Pill, Row, Screen, Stat } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { formatDate, formatMinutes } from '@/lib/format';
import { tapHaptic } from '@/lib/haptics';
import { useCoachNote } from '@/lib/coachNote';
import { todayHeadline } from '@/lib/insights';
import { useScores, useSelectedDay } from '@/lib/ScoresProvider';

export default function TodayScreen() {
  const { scores, sourceLabel, dayBack } = useScores();
  // "today" is whichever day is picked with the day pager; the latest day unless swiped back.
  const { score: today, day: todayData, isLatest } = useSelectedDay();
  const note = useCoachNote(today?.date);
  // Three rings side by side must fit narrow phones (or a large display-size setting): size them
  // from the width the card actually has, up to 104. Until it's measured, estimate from the screen.
  const { width: screenWidth } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(screenWidth - 2 * spacing.md - 2 * (spacing.md + 3));
  const ringSize = Math.min(104, Math.floor((rowWidth - 2 * spacing.sm) / 3));
  if (!today) return <Screen overline="TODAY" title="No data yet"><Muted>Pull down to refresh.</Muted></Screen>;

  const recovery = today.recovery;
  const recoveryColor = recovery?.zone ? colors.recovery[recovery.zone] : colors.muted;
  const headline = todayHeadline(today);

  return (
    <Screen
      overline={isLatest ? 'TODAY' : dayBack === 1 ? 'YESTERDAY' : `${dayBack} DAYS AGO`}
      title={formatDate(today.date)}
      accessory={
        <View style={styles.accessory}>
          <Pill onPress={() => router.push('/health')}>{`${sourceLabel}  ›`}</Pill>
          <Pressable
            onPress={() => {
              tapHaptic();
              router.push('/live');
            }}
            accessibilityRole="button"
            accessibilityLabel="Live heart rate"
            hitSlop={10}
            style={({ pressed }) => pressed && styles.pressed}>
            <SymbolView
              name={{ ios: 'heart.text.square', android: 'monitor_heart', web: 'monitor_heart' }}
              tintColor={colors.restingHr}
              size={26}
            />
          </Pressable>
          <Pressable
            onPress={() => {
              tapHaptic();
              router.push('/account');
            }}
            accessibilityRole="button"
            accessibilityLabel="Account"
            hitSlop={10}
            style={({ pressed }) => pressed && styles.pressed}>
            <SymbolView
              name={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
              tintColor={colors.muted}
              size={26}
            />
          </Pressable>
        </View>
      }
      glow={recoveryColor}>

      <Card>
        <DayPager>
          <View style={styles.rings} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
            <ScoreRing
              label="RECOVERY"
              size={ringSize}
              labelWidth={ringSize}
              value={recovery?.score ?? null}
              suffix="%"
              progress={(recovery?.score ?? 0) / 100}
              color={recoveryColor}
              onPress={() => router.push('/recovery')}
            />
            <ScoreRing
              label="STRAIN"
              size={ringSize}
              labelWidth={ringSize}
              value={today.strain.strain}
              decimals={1}
              progress={today.strain.strain / 21}
              color={colors.strain}
              onPress={() => router.navigate('/strain')}
            />
            <ScoreRing
              label="SLEEP"
              size={ringSize}
              labelWidth={ringSize}
              value={today.sleep?.score ?? null}
              suffix="%"
              progress={(today.sleep?.score ?? 0) / 100}
              color={colors.sleep}
              onPress={() => router.navigate('/sleep')}
            />
          </View>
        </DayPager>
        {headline ? <Text style={[styles.headline, { color: recoveryColor }]}>{headline}</Text> : null}
        <Muted>Tap a score to see what drove it.</Muted>
        {recovery?.calibrating ? (
          <Muted>
            Calibrating: {recovery.daysOfHistory} of {CALIBRATED_DAYS} days. Recovery compares you with your own
            baseline, so it gets more accurate over the first two weeks.
          </Muted>
        ) : null}
      </Card>

      {note ? <CoachNoteCard note={note} accent={recoveryColor} /> : null}

      <HeartRateCard date={today.date} />

      <Card title={isLatest ? 'LAST NIGHT' : 'THAT NIGHT'}>
        <Row>
          <Stat label="HRV" value={todayData?.hrvRmssd ? `${todayData.hrvRmssd} ms` : '--'} />
          <Stat label="Resting HR" value={todayData?.restingHr ? `${todayData.restingHr} bpm` : '--'} />
          <Stat
            label="Slept"
            value={today.sleep ? formatMinutes(today.sleep.asleepMinutes) : '--'}
            hint={today.sleep ? `need ${formatMinutes(today.sleep.needMinutes)}` : undefined}
          />
        </Row>
      </Card>

      <Card title="RECOVERY TREND">
        <TrendBars
          label="Recovery"
          max={100}
          color={colors.muted}
          format={(v) => `${Math.round(v)}%`}
          points={scores.slice(-30).map((s) => ({
            date: s.date,
            value: s.recovery?.score ?? null,
            color: s.recovery?.zone ? colors.recovery[s.recovery.zone] : undefined,
          }))}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rings: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  accessory: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pressed: { opacity: 0.6 },
  headline: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
});
