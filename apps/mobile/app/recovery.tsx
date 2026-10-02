import { CALIBRATED_DAYS, MIN_BASELINE_DAYS } from '@fitness/scoring';
import { StyleSheet, Text, View } from 'react-native';

import { Breakdown, BreakdownFactor, BreakdownTotal } from '@/components/Breakdown';
import { LineChart } from '@/components/charts/LineChart';
import { ScoreRing } from '@/components/ScoreRing';
import { TrendBars } from '@/components/TrendBars';
import { Card, Muted, Screen } from '@/components/ui';
import { colors, type } from '@/constants/theme';
import { FACTOR_LABELS, RECOVERY_GUIDANCE, recoveryFactorDetail } from '@/lib/insights';
import { useScores } from '@/lib/ScoresProvider';

export default function RecoveryScreen() {
  const { scores, days } = useScores();
  const recovery = scores.at(-1)?.recovery;

  if (!recovery || recovery.score === null || !recovery.zone || !recovery.breakdown) {
    return (
      <Screen back overline="RECOVERY" title="This morning">
        <Card title="NOT ENOUGH DATA YET">
          <Muted>
            Recovery compares last night with your own normal, so it needs at least {MIN_BASELINE_DAYS} nights of HRV and
            resting heart rate first ({recovery?.daysOfHistory ?? 0} so far).
          </Muted>
        </Card>
      </Screen>
    );
  }

  const color = colors.recovery[recovery.zone];
  const { typical, factors } = recovery.breakdown;
  const scale = Math.max(...factors.map((f) => Math.abs(f.points)), 1);
  const guidance = RECOVERY_GUIDANCE[recovery.zone];

  return (
    <Screen back overline="RECOVERY" title="This morning" glow={color}>
      <Card>
        <View style={styles.hero}>
          <ScoreRing label="RECOVERY" value={recovery.score} suffix="%" progress={recovery.score / 100} color={color} size={150} />
          <Text style={[styles.verdict, { color }]}>{guidance.title}</Text>
          <Muted>{guidance.body}</Muted>
        </View>
      </Card>

      <Card title={`WHY ${recovery.score}%`}>
        <Breakdown>
          <BreakdownTotal
            label="A typical night for you"
            detail="What you'd score if everything matched your 30-day normal"
            value={`${typical}%`}
          />
          {factors.map((f) => (
            <BreakdownFactor
              key={f.key}
              label={FACTOR_LABELS[f.key]}
              detail={recoveryFactorDetail(f)}
              delta={f.points}
              scale={scale}
            />
          ))}
          <BreakdownTotal label="Today" value={`${recovery.score}%`} color={color} />
        </Breakdown>
      </Card>

      {recovery.calibrating ? (
        <Card title="STILL CALIBRATING">
          <Muted>
            {recovery.daysOfHistory} of {CALIBRATED_DAYS} nights. "Your usual" gets more accurate as the app learns your
            normal range, so expect scores to settle over the first two weeks.
          </Muted>
        </Card>
      ) : null}

      <Card title="HEART RATE VARIABILITY">
        <LineChart
          label="HRV"
          points={days.slice(-30).map((d) => ({ date: d.date, value: d.hrvRmssd ?? null }))}
          color={colors.hrv}
          format={(v) => `${Math.round(v)} ms`}
          higherIsBetter
        />
      </Card>

      <Card title="RESTING HEART RATE">
        <LineChart
          label="Resting HR"
          points={days.slice(-30).map((d) => ({ date: d.date, value: d.restingHr ?? null }))}
          color={colors.restingHr}
          format={(v) => `${Math.round(v)} bpm`}
          higherIsBetter={false}
        />
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

      <Card title="HOW IT WORKS">
        <Muted>
          Each morning we compare last night&apos;s heart rate variability and resting heart rate with your own median
          from the last 30 days, not with other people. HRV counts most (about 60%), resting heart rate about 25% and
          sleep about 15%. The result is squashed onto 0&ndash;100% so one odd reading can&apos;t send it to an extreme.
          Green is 67% and up, yellow 34&ndash;66%, red below 34%.
        </Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 10 },
  verdict: { ...type.title, textAlign: 'center' },
});
