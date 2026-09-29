import { StyleSheet, View } from 'react-native';

import { ScoreRing } from '@/components/ScoreRing';
import { TrendBars } from '@/components/TrendBars';
import { Card, Muted, Row, Screen, Stat } from '@/components/ui';
import { colors } from '@/constants/theme';
import { formatMinutes } from '@/lib/format';
import { useScores } from '@/lib/ScoresProvider';

const STAGES = [
  { key: 'awake', label: 'Awake', color: '#E8E8E8' },
  { key: 'light', label: 'Light', color: '#6C7BD9' },
  { key: 'deep', label: 'Deep', color: '#3F4DB8' },
  { key: 'rem', label: 'REM', color: '#B39DF5' },
] as const;

export default function SleepScreen() {
  const { scores, days } = useScores();
  const sleep = scores.at(-1)?.sleep;
  const session = days.at(-1)?.sleep;
  if (!sleep || !session) return <Screen><Muted>No sleep recorded last night.</Muted></Screen>;

  const totalStages = STAGES.reduce((sum, s) => sum + session.stages[s.key], 0);

  return (
    <Screen>
      <Card>
        <View style={styles.hero}>
          <ScoreRing label="SLEEP PERFORMANCE" display={`${sleep.score}%`} progress={sleep.score / 100} color={colors.sleep} size={140} />
          <Muted>
            You slept {formatMinutes(sleep.asleepMinutes)} of the {formatMinutes(sleep.needMinutes)} your body needed.
          </Muted>
        </View>
      </Card>

      <Card title="STAGES">
        <View style={styles.stageBar}>
          {STAGES.map((s) => (
            <View key={s.key} style={{ flex: session.stages[s.key] / totalStages, backgroundColor: s.color }} />
          ))}
        </View>
        <Row>
          {STAGES.map((s) => (
            <Stat key={s.key} label={s.label} value={formatMinutes(session.stages[s.key])} />
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
        <TrendBars max={100} color={colors.sleep} points={scores.slice(-14).map((s) => ({ date: s.date, value: s.sleep?.score ?? null }))} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 12 },
  stageBar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden' },
});
