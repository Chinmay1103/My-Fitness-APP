import { habitImpact } from '@fitness/scoring';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Muted, Screen } from '@/components/ui';
import { fonts, spacing, type } from '@/constants/theme';
import { useAskCoach } from '@/lib/askCoach';
import { formatTime } from '@/lib/format';
import { useScores } from '@/lib/ScoresProvider';
import { makeStyles, useColors } from '@/lib/theme';

/**
 * What your habits do to you: for each thing you've told the coach about (drinks, late coffee, a
 * late dinner...), the next morning's recovery and that night's sleep compared with days without
 * it. Logging happens in the coach chat; this screen only reads.
 */
export default function HabitsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { scores, logged, sourceId } = useScores();
  const impacts = useMemo(() => habitImpact(logged.habits, scores), [logged.habits, scores]);
  const recent = [...logged.habits].sort((a, b) => b.occurredAt - a.occurredAt).slice(0, 12);
  const { ask, busy } = useAskCoach();

  const effect = (diff: number | null, unit: string) => {
    if (diff == null) return { text: 'not enough days yet', color: colors.muted };
    if (Math.abs(diff) < 2) return { text: `about the same (${diff > 0 ? '+' : ''}${diff}${unit})`, color: colors.muted };
    return { text: `${diff > 0 ? '+' : '−'}${Math.abs(diff)}${unit}`, color: diff > 0 ? colors.recovery.green : colors.recovery.red };
  };

  return (
    <Screen back overline="HABITS" title="What they do to you" glow={colors.recovery.yellow}>
      {impacts.length ? (
        impacts.map((h) => {
          const rec = effect(h.recoveryDiff, ' recovery');
          const slp = effect(h.sleepDiff, ' sleep');
          return (
            <Card key={h.kind} title={h.kind.toUpperCase()}>
              <View style={styles.row}>
                <Text style={styles.label}>Next morning</Text>
                <Text style={[styles.value, { color: rec.color }]}>{rec.text}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>That night</Text>
                <Text style={[styles.value, { color: slp.color }]}>{slp.text}</Text>
              </View>
              <Muted>
                {`${h.daysWith} day${h.daysWith === 1 ? '' : 's'} with it vs ${h.daysWithout} without, last 60 days.${h.early ? ' Early hint: a few more days make it solid.' : ''}`}
              </Muted>
            </Card>
          );
        })
      ) : (
        <Card>
          <Muted>
            Nothing logged yet. Tell the coach when you have a drink, a late coffee, a late dinner, screens in bed, a stressful
            day or a meditation, and after a few of each this screen shows what they do to your recovery and sleep.
          </Muted>
        </Card>
      )}

      {recent.length ? (
        <Card title="RECENTLY LOGGED">
          {recent.map((h) => (
            <View key={h.id} style={styles.listRow}>
              <Text style={styles.listDate}>
                {`${new Date(h.occurredAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} ${formatTime(h.occurredAt)}`}
              </Text>
              <Text style={styles.listText}>{`${h.kind}${h.amount ? ` × ${h.amount}` : ''}`}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Card title="HOW TO LOG">
        <Muted>
          {sourceId === 'mock'
            ? 'These are demo habits. With your own data, just mention them to the coach: “had 2 beers tonight”, “coffee at 5 pm”.'
            : 'Just mention them to the coach, typed or spoken: “had 2 beers tonight”, “coffee at 5 pm”, “dinner at 11”.'}
        </Muted>
        <Button label={busy ? 'Opening Claude…' : 'Log a habit with the coach'} disabled={busy} variant="secondary" onPress={() => ask('I want to log a habit: ')} />
        <Muted>Days with a habit are compared with days without it, so it shows a link, not a proof: other things may differ too.</Muted>
      </Card>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  label: { ...type.body, color: colors.muted },
  value: { fontFamily: fonts.bodySemi, fontSize: 16 },
  listRow: { flexDirection: 'row', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  listDate: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12, width: 140 },
  listText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 14 },
}));
