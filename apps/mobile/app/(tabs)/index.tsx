import { CALIBRATED_DAYS, MOCK_PROFILE } from '@fitness/scoring';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CoachNoteCard } from '@/components/CoachNoteCard';
import { MetricTile } from '@/components/MetricTile';
import { NextStepsCard } from '@/components/NextStepsCard';
import { ScoreRing } from '@/components/ScoreRing';
import { DayPager } from '@/components/Swipe';
import { Card, Muted, Pill, Screen } from '@/components/ui';
import { fonts, spacing, type } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { formatDate } from '@/lib/format';
import { tapHaptic } from '@/lib/haptics';
import { useCoachNote } from '@/lib/coachNote';
import { todayHeadline } from '@/lib/insights';
import { DASHBOARD_ORDER, METRICS } from '@/lib/metrics';
import { nextSteps } from '@/lib/nextSteps';
import { useScores, useSelectedDay } from '@/lib/ScoresProvider';

export default function TodayScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { scores, days, metrics, sourceLabel, dayBack } = useScores();
  // "today" is whichever day is picked with the day pager; the latest day unless swiped back.
  const { score: today, isLatest, index } = useSelectedDay();
  // Suggestions are about what's still ahead, so only for the latest day.
  const steps = useMemo(() => nextSteps({ scores, days, metrics, profile: MOCK_PROFILE }), [scores, days, metrics]);
  const series = useMemo(
    () => Object.fromEntries(DASHBOARD_ORDER.map((key) => [key, metrics.map(METRICS[key].value)])),
    [metrics],
  );
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

      {isLatest ? <NextStepsCard steps={steps} /> : null}

      {note ? <CoachNoteCard note={note} accent={recoveryColor} /> : null}

      <Text style={styles.section}>{isLatest ? 'YOUR METRICS' : 'THAT DAY'}</Text>
      {pairs(DASHBOARD_ORDER).map((pair) => (
        <View key={pair[0]} style={styles.tileRow}>
          {pair.map((key) => (
            <MetricTile key={key} def={METRICS[key]} series={series[key]} index={index} />
          ))}
        </View>
      ))}
    </Screen>
  );
}

function pairs<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  rings: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  accessory: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pressed: { opacity: 0.6 },
  headline: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
  section: { ...type.overline, color: colors.muted, marginTop: spacing.sm, marginLeft: 4 },
  tileRow: { flexDirection: 'row', gap: spacing.md },
}));
