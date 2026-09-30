import { CALIBRATED_DAYS } from '@fitness/scoring';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { ScoreRing } from '@/components/ScoreRing';
import { TrendBars } from '@/components/TrendBars';
import { Card, Muted, Row, Screen, Stat } from '@/components/ui';
import { colors, fonts, type } from '@/constants/theme';
import { formatDate, formatMinutes } from '@/lib/format';
import { todayHeadline } from '@/lib/insights';
import { useScores } from '@/lib/ScoresProvider';

export default function TodayScreen() {
  const { scores, days, sourceLabel } = useScores();
  const today = scores.at(-1);
  const todayData = days.at(-1);
  if (!today) return <Screen overline="TODAY" title="No data yet"><Muted>Pull down to refresh.</Muted></Screen>;

  const recovery = today.recovery;
  const recoveryColor = recovery?.zone ? colors.recovery[recovery.zone] : colors.muted;
  const headline = todayHeadline(today);

  return (
    <Screen
      overline="TODAY"
      title={formatDate(today.date)}
      accessory={<Text style={styles.source}>{sourceLabel}</Text>}
      glow={recoveryColor}>

      <Card>
        <Row>
          <ScoreRing
            label="RECOVERY"
            value={recovery?.score ?? null}
            suffix="%"
            progress={(recovery?.score ?? 0) / 100}
            color={recoveryColor}
            onPress={() => router.push('/recovery')}
          />
          <ScoreRing
            label="STRAIN"
            value={today.strain.strain}
            decimals={1}
            progress={today.strain.strain / 21}
            color={colors.strain}
            onPress={() => router.navigate('/strain')}
          />
          <ScoreRing
            label="SLEEP"
            value={today.sleep?.score ?? null}
            suffix="%"
            progress={(today.sleep?.score ?? 0) / 100}
            color={colors.sleep}
            onPress={() => router.navigate('/sleep')}
          />
        </Row>
        {headline ? <Text style={[styles.headline, { color: recoveryColor }]}>{headline}</Text> : null}
        <Muted>Tap a score to see what drove it.</Muted>
        {recovery?.calibrating ? (
          <Muted>
            Calibrating: {recovery.daysOfHistory} of {CALIBRATED_DAYS} days. Recovery compares you with your own
            baseline, so it gets more accurate over the first two weeks.
          </Muted>
        ) : null}
      </Card>

      <Card title="LAST NIGHT">
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

      <Card title="RECOVERY, LAST 14 DAYS">
        <TrendBars
          label="Recovery"
          max={100}
          color={colors.muted}
          points={scores.slice(-14).map((s) => ({
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
  source: { ...type.caption, color: colors.muted },
  headline: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
});
