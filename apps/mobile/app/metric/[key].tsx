import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/charts/LineChart';
import { StatusChip } from '@/components/MetricTile';
import { DayPager } from '@/components/Swipe';
import { TrendBars } from '@/components/TrendBars';
import { Button, Card, Muted, Row, Screen, Stat } from '@/components/ui';
import { fonts, spacing, type, withAlpha } from '@/constants/theme';
import { formatCount, formatDate, formatMinutes, formatTime } from '@/lib/format';
import { DAILY_ZONE_GOAL, METRICS, metricStatus, normalRange, STEP_GOAL, type DayMetrics, type MetricDef, type MetricKey } from '@/lib/metrics';
import { useScores, useSelectedDay } from '@/lib/ScoresProvider';
import { makeStyles, useColors } from '@/lib/theme';

/**
 * One metric up close: the picked day's value against your normal, 30 days of it, what feeds it
 * and what it means. Opened from a tile on Today; swipe the top card to change day.
 */
export default function MetricScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const def = METRICS[key as MetricKey];
  const colors = useColors();
  const styles = useStyles();
  const { metrics } = useScores();
  const { index, isLatest, score } = useSelectedDay();
  if (!def) {
    return (
      <Screen back title="Not found">
        <Muted>That metric doesn’t exist.</Muted>
      </Screen>
    );
  }

  const color = def.color(colors);
  const series = metrics.map(def.value);
  const value = series[index] ?? null;
  const m = metrics[index];
  const status = metricStatus(def, series, index);
  const history = series.slice(Math.max(0, index - 30), index).filter((v): v is number => v != null);
  const usual = history.length >= 5 ? normalRange(history) : null;
  const points = metrics.map((d, i) => ({ date: d.date, value: series[i] ?? null }));
  const max = Math.max(...series.filter((v): v is number => v != null), def.goal ?? 0, 1) * 1.1;

  return (
    <Screen back overline={def.label.toUpperCase()} title={score ? (isLatest ? 'Today' : formatDate(score.date)) : ''} glow={color}>
      <Card>
        <DayPager>
          <View style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: withAlpha(color, 0.16) }]}>
              <SymbolView name={def.icon} tintColor={color} size={26} />
            </View>
            <View style={styles.heroValue}>
              <Text style={[styles.value, { color: value != null ? colors.text : colors.muted }]}>{value != null ? def.format(value) : '--'}</Text>
              <Text style={styles.unit}>{def.unit}</Text>
            </View>
            {status ? (
              <View style={styles.center}>
                <StatusChip status={status} />
              </View>
            ) : null}
            <Muted>
              {value == null
                ? 'Nothing recorded for this day.'
                : def.goal
                  ? `Goal ${def.format(def.goal)} ${def.unit}.`
                  : usual
                    ? `Your usual: ${def.format(usual.low)}–${def.format(usual.high)} ${def.unit} (middle half of the last 30 days).`
                    : 'A few more days and this will be compared with your own normal.'}
            </Muted>
          </View>
        </DayPager>
      </Card>

      {m ? <Extra def={def} m={m} metrics={metrics} index={index} /> : null}

      <Card title="LAST 30 DAYS">
        {def.chart === 'bars' ? (
          <TrendBars label={def.label} points={points} max={max} color={color} format={(v) => `${def.format(v)} ${def.unit}`} />
        ) : (
          <LineChart label={def.label} points={points} color={color} format={(v) => `${def.format(v)} ${def.unit}`} higherIsBetter={def.higherIsBetter ?? true} />
        )}
      </Card>

      <Card title="WHAT IT MEANS">
        <Text style={styles.body}>{def.about}</Text>
        <Text style={styles.subhead}>What moves it</Text>
        <Text style={styles.body}>{def.affects}</Text>
      </Card>
    </Screen>
  );
}

/** The part that's different per metric: where the number came from. */
function Extra({ def, m, metrics, index }: { def: MetricDef; m: DayMetrics; metrics: DayMetrics[]; index: number }) {
  const colors = useColors();
  const styles = useStyles();
  switch (def.key) {
    case 'steps':
      if (!m.steps) return null;
      return (
        <Card title="WHERE YOUR STEPS CAME FROM">
          <Row>
            <Stat label="Band counted" value={formatCount(m.steps.band)} color={colors.steps} />
            <Stat label="Phone counted" value={formatCount(m.steps.phone)} color={colors.muted} />
          </Row>
          <Row>
            <Stat label="Ghost steps removed" value={`−${formatCount(m.steps.ghost)}`} color={colors.recovery.red} />
            <Stat label="Phone only (band off)" value={`+${formatCount(m.steps.phoneOnly)}`} color={colors.recovery.green} />
          </Row>
          <HourBars values={m.steps.hourly} color={colors.steps} format={formatCount} />
          <Muted>
            {m.steps.phone === 0
              ? 'No phone steps that day, so only heart rate could confirm the band’s count.'
              : `Counted: ${formatCount(m.steps.total)} toward your goal of ${formatCount(STEP_GOAL)}, hour by hour above.`}
          </Muted>
        </Card>
      );
    case 'heartRate':
      return m.heartRate ? (
        <Card title="THE DAY">
          <Row>
            <Stat label="Low" value={`${m.heartRate.low}`} hint="bpm" />
            <Stat label="Average" value={`${Math.round(m.heartRate.avg)}`} hint="bpm" />
            <Stat label="High" value={`${m.heartRate.high}`} hint="bpm" />
          </Row>
          <Muted>{`The band saw ${formatMinutes(m.heartRate.minutesCovered)} of the day.`}</Muted>
          <Button label="Open the full day, zone by zone" onPress={() => router.push('/heart-rate')} />
        </Card>
      ) : null;
    case 'restingHr':
    case 'hrv':
    case 'breathing':
      return (
        <Card title="PART OF RECOVERY">
          <Muted>
            {def.key === 'hrv'
              ? 'HRV is the biggest part of your recovery score (about 60%).'
              : def.key === 'restingHr'
                ? 'Resting heart rate is about a quarter of your recovery score.'
                : 'Breathing rate counts for 10% of recovery once there are 4 nights to compare with.'}
          </Muted>
          <Button label="See how it moved recovery" onPress={() => router.push('/recovery')} variant="secondary" />
        </Card>
      );
    case 'zoneMinutes':
      return m.zones ? (
        <Card title="BY ZONE">
          <Row>
            <Stat label="Fat burn ×1" value={`${m.zones.fatBurn}`} hint="min" color={colors.hrZones[1]} />
            <Stat label="Cardio ×2" value={`${m.zones.cardio}`} hint="min" color={colors.hrZones[3]} />
            <Stat label="Peak ×2" value={`${m.zones.peak}`} hint="min" color={colors.hrZones[4]} />
          </Row>
          <Muted>{`${m.weekly.minutes} of 150 this week. About ${DAILY_ZONE_GOAL} a day keeps you on track.`}</Muted>
        </Card>
      ) : null;
    case 'weeklyCardio': {
      const week = metrics.slice(Math.max(0, index - 6), index + 1);
      return (
        <Card title="THIS WEEK, DAY BY DAY">
          <HourBars
            values={week.map((d) => d.zones?.total ?? 0)}
            labels={week.map((d) => new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' }))}
            color={colors.strain}
            format={(v) => `${v} min`}
          />
          <Muted>{`${m.weekly.minutes} zone minutes in the last 7 days${m.weekly.minutes >= 150 ? ': goal reached.' : `: ${150 - m.weekly.minutes} to go.`}`}</Muted>
        </Card>
      );
    }
    case 'energy':
      return m.nutrition.calories != null && m.energy != null ? (
        <Card title="IN VS OUT">
          <Row>
            <Stat label="Burned" value={formatCount(m.energy)} hint="kcal" color={colors.calories} />
            <Stat label="Eaten (logged)" value={formatCount(m.nutrition.calories)} hint="kcal" color={colors.recovery.green} />
            <Stat label="Balance" value={`${m.nutrition.calories - m.energy > 0 ? '+' : ''}${formatCount(m.nutrition.calories - m.energy)}`} hint="kcal" />
          </Row>
          <Muted>Only as complete as the meals you logged.</Muted>
        </Card>
      ) : null;
    case 'caloriesIn':
    case 'macros':
      return (
        <Card title="MEALS">
          {m.nutrition.meals.length ? (
            <>
              <Row>
                <Stat label="Protein" value={m.nutrition.proteinG != null ? `${m.nutrition.proteinG}` : '--'} hint="g" color={colors.recovery.green} />
                <Stat label="Carbs" value={m.nutrition.carbsG != null ? `${m.nutrition.carbsG}` : '--'} hint="g" color={colors.calories} />
                <Stat label="Fat" value={m.nutrition.fatG != null ? `${m.nutrition.fatG}` : '--'} hint="g" color={colors.strain} />
              </Row>
              {m.nutrition.meals.map((meal) => (
                <View key={meal.id} style={styles.listRow}>
                  <Text style={styles.listTime}>{formatTime(meal.eatenAt)}</Text>
                  <Text style={styles.listText} numberOfLines={2}>
                    {meal.description ?? 'Meal'}
                  </Text>
                  <Text style={styles.listValue}>{meal.calories != null ? `${formatCount(meal.calories)} kcal` : ''}</Text>
                </View>
              ))}
            </>
          ) : (
            <Muted>No meals logged this day.</Muted>
          )}
          <Button label="Tell the coach what you ate" onPress={() => router.navigate('/coach')} variant="secondary" />
        </Card>
      );
    case 'weight':
      return (
        <Card title="WEIGH-INS">
          <Muted>{m.weightKg != null ? 'Tell the coach your weight whenever you step on a scale.' : 'No weigh-ins yet. Tell the coach your weight and it shows up here.'}</Muted>
          <Button label="Open the coach" onPress={() => router.navigate('/coach')} variant="secondary" />
        </Card>
      );
    default:
      return null;
  }
}

/** Small bar row (hours of a day, or days of a week), labels underneath. */
function HourBars({ values, color, format, labels }: { values: number[]; color: string; format: (v: number) => string; labels?: string[] }) {
  const styles = useStyles();
  const max = Math.max(...values, 1);
  const peak = values.indexOf(Math.max(...values));
  return (
    <View>
      <View style={styles.bars} accessible accessibilityLabel={`Most at ${labels ? labels[peak] : `${peak}:00`}: ${format(values[peak] ?? 0)}`}>
        {values.map((v, i) => (
          <View key={i} style={styles.barSlot}>
            <View style={[styles.bar, { height: `${Math.max((v / max) * 100, v > 0 ? 4 : 1)}%`, backgroundColor: color, opacity: v > 0 ? 0.9 : 0.15 }]} />
          </View>
        ))}
      </View>
      <View style={styles.barLabels}>
        {labels
          ? labels.map((l, i) => (
              <Text key={i} style={styles.barLabel}>
                {l}
              </Text>
            ))
          : ['12 AM', '6 AM', '12 PM', '6 PM', ''].map((l, i) => (
              <Text key={i} style={styles.barLabel}>
                {l}
              </Text>
            ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm },
  center: { alignSelf: 'center' },
  heroIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  heroValue: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  value: { fontFamily: fonts.number, fontSize: 56, fontVariant: ['tabular-nums'] },
  unit: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 15 },
  body: { ...type.body, color: colors.text },
  subhead: { ...type.overline, color: colors.muted, marginTop: spacing.xs },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  listTime: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12, width: 62 },
  listText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 14 },
  listValue: { color: colors.text, fontFamily: fonts.numberSemi, fontSize: 15 },
  bars: { height: 70, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  barLabel: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 10 },
}));
