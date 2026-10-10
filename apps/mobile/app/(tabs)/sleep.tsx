import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Breakdown, BreakdownFactor, BreakdownTotal } from '@/components/Breakdown';
import { ComboChart } from '@/components/charts/ComboChart';
import { Donut } from '@/components/charts/Donut';
import { Hypnogram } from '@/components/charts/Hypnogram';
import { ScoreRing } from '@/components/ScoreRing';
import { DayPager } from '@/components/Swipe';
import { TrendBars } from '@/components/TrendBars';
import { Card, Muted, Row, Screen, Stat } from '@/components/ui';
import { makeStyles, useColors } from '@/lib/theme';
import { formatDate, formatMinutes } from '@/lib/format';
import { useScores, useSelectedDay } from '@/lib/ScoresProvider';
import { trendHref, type TrendKey } from '@/lib/trends';

const open = (key: TrendKey) => () => router.push(trendHref(key));

const STAGES = [
  { key: 'deep', label: 'Deep' },
  { key: 'rem', label: 'REM' },
  { key: 'light', label: 'Light' },
  { key: 'awake', label: 'Awake' },
] as const;

export default function SleepScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { scores } = useScores();
  const { score, day, previous, isLatest } = useSelectedDay();
  const sleep = score?.sleep;
  const need = score?.sleepNeed;
  const priorStrain = previous?.strain.strain;
  const session = day?.sleep;
  // The night that ended on the picked day's morning.
  const title = isLatest || !score ? 'Last night' : `Night into ${formatDate(score.date)}`;
  if (!sleep || !session) {
    return (
      <Screen overline="SLEEP" title={title}>
        <Card>
          <DayPager />
          <Muted>No sleep recorded that night.</Muted>
        </Card>
      </Screen>
    );
  }

  const { ceiling, penalties } = sleep.breakdown;
  const penaltyScale = Math.max(penalties.efficiency, penalties.restorative, penalties.consistency, 1);
  const bedtimeDrift = Math.round((1 - sleep.consistency) * 120);

  return (
    <Screen overline="SLEEP" title={title} glow={colors.sleep}>
      <Card>
        <DayPager>
          <View style={styles.hero}>
            <ScoreRing label="SLEEP PERFORMANCE" value={sleep.score} suffix="%" progress={sleep.score / 100} color={colors.sleep} size={140} />
            <Muted>
              You slept {formatMinutes(sleep.asleepMinutes)} of the {formatMinutes(sleep.needMinutes)} your body needed.
            </Muted>
          </View>
        </DayPager>
      </Card>

      {session.segments?.length ? (
        <Card title={isLatest ? 'LAST NIGHT, STAGE BY STAGE' : 'STAGE BY STAGE'} onPress={open('restorative')} linkLabel="Deep + REM">
          <Hypnogram segments={session.segments} />
        </Card>
      ) : null}

      <Card title={`WHY ${sleep.score}%`} onPress={open('hoursSlept')} linkLabel="Hours">
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
            onPress={open('efficiency')}
          />
          <BreakdownFactor
            label="Restorative sleep"
            detail={`${Math.round(sleep.restorativeRatio * 100)}% deep + REM (40% or more is ideal)`}
            delta={-penalties.restorative}
            scale={penaltyScale}
            onPress={open('restorative')}
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
            onPress={open('consistency')}
          />
          <BreakdownTotal label="Sleep performance" value={`${sleep.score}%`} color={colors.sleep} />
        </Breakdown>
        <Muted>Hours matter most: quality can take up to 30% off, but a short night can never score high.</Muted>
      </Card>

      {need ? (
        <Card title={`${isLatest ? 'LAST NIGHT ' : ''}YOU NEEDED ${formatMinutes(need.total).toUpperCase()}`} onPress={open('sleepNeed')} linkLabel="30 days">
          <Breakdown>
            <BreakdownTotal label="Base need" detail="What an average adult needs; adjustable later" value={formatMinutes(need.base)} />
            <BreakdownFactor
              label={isLatest ? "Yesterday's strain" : "The day before's strain"}
              detail={
                need.strain > 0
                  ? `Strain of ${priorStrain?.toFixed(1)} needs extra recovery (anything over 8 adds time)`
                  : 'Light day, no extra sleep needed'
              }
              delta={need.strain}
              scale={Math.max(need.strain, need.debt, 1)}
              unit="m"
              color={colors.sleep}
              onPress={() => router.navigate('/strain')}
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
              onPress={open('sleepDebt')}
            />
          </Breakdown>
        </Card>
      ) : null}

      <Card title="STAGES" onPress={open('deep')} linkLabel="Deep sleep">
        <Donut
          center={formatMinutes(sleep.asleepMinutes)}
          centerLabel="asleep"
          slices={STAGES.map((s) => ({
            key: s.key,
            label: s.label,
            value: session.stages[s.key],
            color: colors.sleepStages[s.key],
            valueText: formatMinutes(session.stages[s.key]),
          }))}
        />
        <Muted>Tap a stage to see its share. Deep and REM together around 40% of sleep is a good night.</Muted>
      </Card>

      <Card title="QUALITY">
        <Row>
          <Stat label="Efficiency" value={`${Math.round(sleep.efficiency * 100)}%`} hint="asleep / in bed" onPress={open('efficiency')} />
          <Stat label="Restorative" value={`${Math.round(sleep.restorativeRatio * 100)}%`} hint="deep + REM" onPress={open('restorative')} />
          <Stat label="Consistency" value={`${Math.round(sleep.consistency * 100)}%`} hint="bedtime vs usual" onPress={open('consistency')} />
        </Row>
      </Card>

      <Card title="HOURS SLEPT VS NEEDED" onPress={open('hoursSlept')}>
        <ComboChart
          points={scores.slice(-30).map((s) => ({ date: s.date, bar: s.sleep?.asleepMinutes ?? null, line: s.sleep?.needMinutes ?? null }))}
          bar={{ label: 'Slept', color: colors.sleep, max: 11 * 60, format: formatMinutes }}
          line={{ label: 'Needed', color: colors.text, max: 11 * 60, format: formatMinutes, dashed: true }}
          describe={(p) => {
            if (p.bar == null || p.line == null) return 'no sleep recorded';
            const gap = p.bar - p.line;
            return `needed ${formatMinutes(p.line)} · ${Math.abs(gap) < 5 ? 'right on it' : `${formatMinutes(Math.abs(gap))} ${gap > 0 ? 'extra' : 'short'}`}`;
          }}
        />
      </Card>

      <Card title="SLEEP TREND" href="/recovery" linkLabel="Effect on recovery">
        <TrendBars
          label="Sleep performance"
          max={100}
          color={colors.sleep}
          format={(v) => `${Math.round(v)}%`}
          points={scores.slice(-30).map((s) => ({ date: s.date, value: s.sleep?.score ?? null }))}
        />
      </Card>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  hero: { alignItems: 'center', gap: 12 },
}));
