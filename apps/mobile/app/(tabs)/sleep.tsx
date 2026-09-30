import { StyleSheet, View } from 'react-native';

import { Breakdown, BreakdownFactor, BreakdownTotal } from '@/components/Breakdown';
import { ScoreRing } from '@/components/ScoreRing';
import { TrendLine } from '@/components/TrendLine';
import { Card, Muted, Row, Screen, Stat } from '@/components/ui';
import { colors } from '@/constants/theme';
import { formatMinutes } from '@/lib/format';
import { useScores } from '@/lib/ScoresProvider';

const STAGES = [
  { key: 'awake', label: 'Awake' },
  { key: 'light', label: 'Light' },
  { key: 'deep', label: 'Deep' },
  { key: 'rem', label: 'REM' },
] as const;

export default function SleepScreen() {
  const { scores, days } = useScores();
  const sleep = scores.at(-1)?.sleep;
  const need = scores.at(-1)?.sleepNeed;
  const priorStrain = scores.at(-2)?.strain.strain;
  const session = days.at(-1)?.sleep;
  if (!sleep || !session) {
    return (
      <Screen overline="SLEEP" title="Last night">
        <Muted>No sleep recorded last night.</Muted>
      </Screen>
    );
  }

  const totalStages = STAGES.reduce((sum, s) => sum + session.stages[s.key], 0);
  const { ceiling, penalties } = sleep.breakdown;
  const penaltyScale = Math.max(penalties.efficiency, penalties.restorative, penalties.consistency, 1);
  const bedtimeDrift = Math.round((1 - sleep.consistency) * 120);
  // Sleep scores cluster high; start the trend axis a bit below the lowest night so changes are visible.
  const trendScores = scores.slice(-14).flatMap((s) => (s.sleep ? [s.sleep.score] : []));
  const trendMin = Math.max(0, Math.floor((Math.min(...trendScores, 100) - 15) / 10) * 10);

  return (
    <Screen overline="SLEEP" title="Last night" glow={colors.sleep}>
      <Card>
        <View style={styles.hero}>
          <ScoreRing label="SLEEP PERFORMANCE" value={sleep.score} suffix="%" progress={sleep.score / 100} color={colors.sleep} size={140} />
          <Muted>
            You slept {formatMinutes(sleep.asleepMinutes)} of the {formatMinutes(sleep.needMinutes)} your body needed.
          </Muted>
        </View>
      </Card>

      <Card title={`WHY ${sleep.score}%`}>
        <Breakdown>
          <BreakdownTotal
            label="Hours vs need"
            detail={`${formatMinutes(sleep.asleepMinutes)} of ${formatMinutes(sleep.needMinutes)} sets the most you can score`}
            value={`${ceiling}%`}
          />
          <BreakdownFactor
            label="Efficiency"
            detail={`${Math.round(sleep.efficiency * 100)}% of your time in bed was asleep (95% is ideal)`}
            delta={-penalties.efficiency}
            scale={penaltyScale}
          />
          <BreakdownFactor
            label="Restorative sleep"
            detail={`${Math.round(sleep.restorativeRatio * 100)}% deep + REM (40% or more is ideal)`}
            delta={-penalties.restorative}
            scale={penaltyScale}
          />
          <BreakdownFactor
            label="Consistency"
            detail={
              bedtimeDrift <= 5
                ? 'You went to bed at your usual time'
                : `Bedtime was about ${formatMinutes(bedtimeDrift)} off your usual (last 7 nights)`
            }
            delta={-penalties.consistency}
            scale={penaltyScale}
          />
          <BreakdownTotal label="Sleep performance" value={`${sleep.score}%`} color={colors.sleep} />
        </Breakdown>
        <Muted>Hours matter most: quality can take up to 30% off, but a short night can never score high.</Muted>
      </Card>

      {need ? (
        <Card title={`LAST NIGHT YOU NEEDED ${formatMinutes(need.total).toUpperCase()}`}>
          <Breakdown>
            <BreakdownTotal label="Base need" detail="What an average adult needs; adjustable later" value={formatMinutes(need.base)} />
            <BreakdownFactor
              label="Yesterday's strain"
              detail={
                need.strain > 0
                  ? `Strain of ${priorStrain?.toFixed(1)} needs extra recovery (anything over 8 adds time)`
                  : 'Light day, no extra sleep needed'
              }
              delta={need.strain}
              scale={Math.max(need.strain, need.debt, 1)}
              unit="m"
              color={colors.sleep}
            />
            <BreakdownFactor
              label="Sleep debt"
              detail={
                need.debt > 0
                  ? 'Paying back a third of what you missed over the last 3 nights'
                  : 'No debt from the last 3 nights'
              }
              delta={need.debt}
              scale={Math.max(need.strain, need.debt, 1)}
              unit="m"
              color={colors.sleep}
            />
          </Breakdown>
        </Card>
      ) : null}

      <Card title="STAGES">
        <View style={styles.stageBar}>
          {STAGES.map((s) => (
            <View key={s.key} style={{ flex: session.stages[s.key] / totalStages, backgroundColor: colors.sleepStages[s.key] }} />
          ))}
        </View>
        <Row>
          {STAGES.map((s) => (
            <Stat key={s.key} label={s.label} value={formatMinutes(session.stages[s.key])} color={colors.sleepStages[s.key]} />
          ))}
        </Row>
      </Card>

      <Card title="QUALITY">
        <Row>
          <Stat label="Efficiency" value={`${Math.round(sleep.efficiency * 100)}%`} hint="asleep / in bed" />
          <Stat label="Restorative" value={`${Math.round(sleep.restorativeRatio * 100)}%`} hint="deep + REM" />
          <Stat label="Consistency" value={`${Math.round(sleep.consistency * 100)}%`} hint="bedtime vs usual" />
        </Row>
      </Card>

      <Card title="SLEEP PERFORMANCE, LAST 14 DAYS">
        <TrendLine
          label="Sleep performance"
          min={trendMin}
          max={100}
          color={colors.sleep}
          format={(v) => `${Math.round(v)}%`}
          points={scores.slice(-14).map((s) => ({ date: s.date, value: s.sleep?.score ?? null }))}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 12 },
  stageBar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 },
});
