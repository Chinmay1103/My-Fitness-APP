import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/charts/LineChart';
import { DayPager } from '@/components/Swipe';
import { TrendBars } from '@/components/TrendBars';
import { Card, Muted, Row, Screen, Stat } from '@/components/ui';
import { fonts, spacing, type, withAlpha } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { tapHaptic } from '@/lib/haptics';
import { normalRange } from '@/lib/metrics';
import { useScores, useSelectedDay } from '@/lib/ScoresProvider';
import { makeStyles, useColors } from '@/lib/theme';
import { TRENDS, type TrendKey } from '@/lib/trends';

/**
 * One part of the sleep score up close (efficiency, deep + REM, bedtime, hours, need, debt): the
 * picked day against your usual and your 30-day average, 30 days of it, what it means, what moves
 * it, and links to the screens it feeds. Opened from the Sleep tab; swipe the top card to change day.
 */
export default function TrendScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const def = TRENDS[key as TrendKey];
  const colors = useColors();
  const styles = useStyles();
  const { scores, days } = useScores();
  const { index, isLatest, score } = useSelectedDay();
  if (!def) {
    return (
      <Screen back title="Not found">
        <Muted>That detail doesn’t exist.</Muted>
      </Screen>
    );
  }

  const color = def.color(colors);
  const series = scores.map((s) => def.value(s, days.find((d) => d.date === s.date)));
  const value = series[index] ?? null;
  const history = series.slice(Math.max(0, index - 30), index).filter((v): v is number => v != null);
  const usual = history.length >= 5 ? normalRange(history) : null;
  const avg = history.length ? history.reduce((a, b) => a + b, 0) / history.length : null;
  const best = history.length ? (def.higherIsBetter ? Math.max(...history) : Math.min(...history)) : null;
  const points = scores.map((s, i) => ({ date: s.date, value: series[i] ?? null }));
  const max = Math.max(...series.filter((v): v is number => v != null), 1) * 1.1;
  const unit = def.unit === '%' ? '%' : def.unit ? ` ${def.unit}` : '';
  const verdict =
    value == null || !usual
      ? null
      : value > usual.high
        ? def.higherIsBetter
          ? 'Better than usual'
          : 'Higher than usual'
        : value < usual.low
          ? def.higherIsBetter
            ? 'Lower than usual'
            : 'Better than usual'
          : 'In your usual range';

  return (
    <Screen back overline={def.label.toUpperCase()} title={score ? (isLatest ? 'Last night' : formatDate(score.date)) : ''} glow={color}>
      <Card>
        <DayPager>
          <View style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: withAlpha(color, 0.16) }]}>
              <SymbolView name={def.icon} tintColor={color} size={26} />
            </View>
            <View style={styles.heroValue}>
              <Text style={[styles.value, { color: value != null ? colors.text : colors.muted }]}>{value != null ? def.format(value) : '--'}</Text>
              {def.unit ? <Text style={styles.unit}>{def.unit}</Text> : null}
            </View>
            {verdict ? <Text style={[styles.verdict, { color }]}>{verdict}</Text> : null}
            <Muted>
              {value == null
                ? 'Nothing recorded for this night.'
                : usual
                  ? `Your usual: ${def.format(usual.low)}–${def.format(usual.high)}${unit} (middle half of the 30 nights before).`
                  : 'A few more nights and this will be compared with your own normal.'}
            </Muted>
          </View>
        </DayPager>
      </Card>

      <Card title="IN NUMBERS">
        <Row>
          <Stat label="This night" value={value != null ? `${def.format(value)}${unit}` : '--'} />
          <Stat label="30-day average" value={avg != null ? `${def.format(avg)}${unit}` : '--'} />
          <Stat label={def.higherIsBetter ? 'Best' : 'Lowest'} value={best != null ? `${def.format(best)}${unit}` : '--'} />
        </Row>
        {def.target ? <Muted>{`Aim for ${def.target}.`}</Muted> : null}
      </Card>

      <Card title="LAST 30 NIGHTS">
        {def.chart === 'bars' ? (
          <TrendBars label={def.label} points={points} max={max} color={color} format={(v) => `${def.format(v)}${unit}`} />
        ) : (
          <LineChart label={def.label} points={points} color={color} format={(v) => `${def.format(v)}${unit}`} higherIsBetter={def.higherIsBetter} />
        )}
      </Card>

      <Card title="WHAT IT MEANS">
        <Text style={styles.body}>{def.about}</Text>
        <Text style={styles.subhead}>What moves it</Text>
        <Text style={styles.body}>{def.affects}</Text>
      </Card>

      <Card title="RELATED">
        {def.related.map((r) => (
          <Pressable
            key={r.label}
            onPress={() => {
              tapHaptic();
              router.push(r.href);
            }}
            accessibilityRole="link"
            style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
            <Text style={styles.linkText}>{r.label}</Text>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={colors.muted} size={16} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm },
  heroIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  heroValue: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  value: { fontFamily: fonts.number, fontSize: 56, fontVariant: ['tabular-nums'] },
  unit: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 15 },
  verdict: { fontFamily: fonts.bodySemi, fontSize: 15 },
  body: { ...type.body, color: colors.text },
  subhead: { ...type.overline, color: colors.muted, marginTop: spacing.xs },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    minHeight: 40,
  },
  linkText: { ...type.bodyStrong, color: colors.text },
}));
