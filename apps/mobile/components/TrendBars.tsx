import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { colors, fonts, gradientFor, motion } from '@/constants/theme';
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
  points: Point[];
  max: number;
  color: string;
  height?: number;
  format?: (value: number) => string;
}

const VALUE_ROW = 18;

/**
 * Daily bar chart. Bars grow in one after another, the last (today) is full strength and the
 * others slightly dimmed; a dashed line marks the average of the period.
 */
export function TrendBars({ label, points, max, color, height = 110, format = (v) => String(Math.round(v)) }: Props) {
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const avgY = avg !== null ? VALUE_ROW + height - (avg / max) * height : null;
  const today = points.at(-1)?.value;

  return (
    <View
      accessible
      accessibilityLabel={`${label}, last ${points.length} days. Average ${avg !== null ? format(avg) : 'none'}, today ${
        today != null ? format(today) : 'no data'
      }.`}>
      <View>
        <View style={styles.row}>
          {points.map((p, i) => (
            <Bar
              key={p.date}
              point={p}
              index={i}
              isToday={i === points.length - 1}
              max={max}
              color={p.color ?? color}
              height={height}
              format={format}
            />
          ))}
        </View>
        {avgY !== null ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: avgY - 0.5, height: 1 }]}>
            <Svg height={1} width="100%">
              <Line x1="0" y1="0.5" x2="100%" y2="0.5" stroke={colors.text} strokeOpacity={0.35} strokeDasharray="3 4" />
            </Svg>
          </View>
        ) : null}
      </View>
      {avg !== null ? <Text style={styles.avg}>avg {format(avg)}</Text> : null}
    </View>
  );
}

function Bar({
  point,
  index,
  isToday,
  max,
  color,
  height,
  format,
}: {
  point: Point;
  index: number;
  isToday: boolean;
  max: number;
  color: string;
  height: number;
  format: (value: number) => string;
}) {
  const grow = useAnimatedTarget(point.value !== null ? 1 : 0, motion.bars, index * motion.barStagger);
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }] }));
  const barHeight = point.value !== null ? Math.max((point.value / max) * height, 3) : 0;

  return (
    <View style={styles.col}>
      <View style={[styles.track, { height: height + VALUE_ROW }]}>
        {point.value !== null ? (
          <>
            <Text style={[styles.value, isToday && styles.valueToday]} numberOfLines={1}>
              {format(point.value)}
            </Text>
            <Animated.View style={[{ height: barHeight, opacity: isToday ? 1 : 0.6 }, styles.bar, barStyle]}>
              <LinearGradient colors={gradientFor(color)} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </>
        ) : null}
      </View>
      <Text style={[styles.day, isToday && styles.dayToday]}>{shortDay(point.date)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  col: { flex: 1, alignItems: 'stretch', gap: 6 },
  track: { justifyContent: 'flex-end' },
  bar: { borderRadius: 4, overflow: 'hidden', transformOrigin: 'bottom' },
  value: { color: colors.muted, fontFamily: fonts.displaySemi, fontSize: 11, textAlign: 'center', marginBottom: 3 },
  valueToday: { color: colors.text, fontFamily: fonts.display, fontSize: 13 },
  day: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11, textAlign: 'center' },
  dayToday: { color: colors.text, fontFamily: fonts.bodySemi },
  avg: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11, textAlign: 'right', marginTop: 6 },
});
