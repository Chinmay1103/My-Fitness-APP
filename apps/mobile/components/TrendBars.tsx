import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { ChartHeader, DEFAULT_RANGES, RangeSwitch, dayName, usePickedDay, useScrub } from '@/components/charts/parts';
import { fonts, gradientFor, motion } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { useAnimatedTarget } from '@/lib/animation';
import { shortDay } from '@/lib/format';

interface Point {
  date: string;
  value: number | null;
  /** Per-bar color, e.g. the recovery zone. */
  color?: string;
}

interface Props {
  /** What's charted, for screen readers, e.g. "Recovery". */
  label: string;
  /** Oldest first, ending today. Pass at least 30 days. */
  points: Point[];
  max: number;
  color: string;
  height?: number;
  format?: (value: number) => string;
}

const GAP = 3;

/**
 * The day-by-day bar chart: a bar per day, grown in one after another, with a dashed line at the
 * period's average. Drag across the bars to scrub (a light tick per day); the readout above shows
 * the picked day against the average. 7D / 14D / 30D switch, 14 first.
 */
export function TrendBars({ label, points: allPoints, max, color, height = 110, format = (v) => String(Math.round(v)) }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const [range, setRange] = useState<number>(DEFAULT_RANGES[1]);
  const points = allPoints.slice(-range);
  const n = points.length;
  const { index, pick, reset } = usePickedDay(n, (i) => points[i]?.value != null);
  const { scrubProps } = useScrub((f) => pick(Math.floor(f * n)));

  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const avgY = avg !== null ? height - (avg / max) * height : null;
  const selected = points[index];
  const diff = selected?.value != null && avg !== null ? selected.value - avg : null;
  // With many bars, only label one day a week (counting back from today) plus the picked one.
  const labelEvery = n > 14 ? 7 : 1;

  return (
    <View style={styles.wrap}>
      <ChartHeader
        value={selected?.value != null ? format(selected.value) : '--'}
        color={selected?.value != null ? gradientFor(selected.color ?? color, colors)[0] : colors.muted}
        title={selected ? dayName(selected.date, index === n - 1) : ''}
        detail={
          diff === null
            ? undefined
            : Math.abs(diff) < max * 0.005
              ? `right on your ${range}-day average`
              : `${format(Math.abs(diff))} ${diff > 0 ? 'above' : 'below'} your ${range}-day average`
        }
        right={
          <RangeSwitch
            value={range}
            onChange={(r) => {
              setRange(r);
              reset();
            }}
          />
        }
      />

      <View
        {...scrubProps}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${label}, last ${n} days. Average ${avg !== null ? format(avg) : 'none'}.`}
        accessibilityValue={{ text: selected ? `${dayName(selected.date, index === n - 1)}: ${selected.value != null ? format(selected.value) : 'no data'}` : '' }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => pick(index + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}>
        <View style={[styles.row, { height }]} pointerEvents="none">
          {points.map((p, i) => (
            <Bar key={p.date} point={p} index={i} isSelected={i === index} max={max} color={p.color ?? color} height={height} />
          ))}
          {avgY !== null ? (
            <View style={[StyleSheet.absoluteFill, { top: avgY - 0.5, height: 1 }]}>
              <Svg height={1} width="100%">
                <Line x1="0" y1="0.5" x2="100%" y2="0.5" stroke={colors.text} strokeOpacity={0.35} strokeDasharray="3 4" />
              </Svg>
            </View>
          ) : null}
        </View>
        <View style={styles.row} pointerEvents="none">
          {points.map((p, i) => (
            <View key={p.date} style={styles.dayCell}>
              {i === index || (n - 1 - i) % labelEvery === 0 ? (
                <Text style={[styles.day, i === index && styles.daySelected]} numberOfLines={1}>
                  {shortDay(p.date)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function Bar({ point, index, isSelected, max, color, height }: { point: Point; index: number; isSelected: boolean; max: number; color: string; height: number }) {
  const colors = useColors();
  const styles = useStyles();
  const grow = useAnimatedTarget(point.value !== null ? 1 : 0, motion.bars, index * motion.barStagger);
  const lit = useAnimatedTarget(isSelected ? 1 : 0.45, 180);
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }], opacity: lit.value }));
  const barHeight = point.value !== null ? Math.max((point.value / max) * height, 3) : 0;

  return (
    <View style={[styles.col, isSelected && styles.colSelected]}>
      {point.value !== null ? (
        <Animated.View style={[{ height: barHeight }, styles.bar, barStyle]}>
          <LinearGradient colors={gradientFor(color, colors)} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  wrap: { gap: 12 },
  row: { flexDirection: 'row', gap: GAP },
  col: { flex: 1, justifyContent: 'flex-end', borderRadius: 4 },
  colSelected: { backgroundColor: colors.track },
  bar: { borderRadius: 4, overflow: 'hidden', transformOrigin: 'bottom' },
  dayCell: { flex: 1, alignItems: 'center', marginTop: 6 },
  // Wider than its bar, so a label never gets cut off when bars are thin.
  day: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11, marginHorizontal: -12, textAlign: 'center' },
  daySelected: { color: colors.text, fontFamily: fonts.bodySemi },
}));
