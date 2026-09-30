import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { colors, fonts, gradientFor, motion } from '@/constants/theme';
import { useAnimatedTarget } from '@/lib/animation';
import { tapHaptic } from '@/lib/haptics';
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

const VALUE_ROW = 20;

/**
 * The app's one trend chart: a bar per day, grown in one after another, with a dashed line at the
 * period's average. Only the selected day is labelled (today, until you tap another bar), so the
 * chart stays readable on a phone. Bars use the same gradients as the rings, at full strength.
 */
export function TrendBars({ label, points, max, color, height = 110, format = (v) => String(Math.round(v)) }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const avgY = avg !== null ? VALUE_ROW + height - (avg / max) * height : null;
  const lastIndex = points.length - 1;
  const pickedIndex = points.findIndex((p) => p.date === picked);
  const selectedIndex = pickedIndex >= 0 ? pickedIndex : lastIndex;
  const selected = points[selectedIndex];

  const select = (i: number) => {
    tapHaptic();
    // Tapping the selected bar again goes back to today.
    setPicked(i === selectedIndex || i === lastIndex ? null : points[i].date);
  };

  return (
    <View>
      <View>
        <View style={styles.row}>
          {points.map((p, i) => (
            <Bar
              key={p.date}
              point={p}
              index={i}
              isSelected={i === selectedIndex}
              isToday={i === lastIndex}
              max={max}
              color={p.color ?? color}
              height={height}
              format={format}
              onPress={() => select(i)}
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
      <View
        style={styles.footer}
        accessible
        accessibilityLabel={`${label}, last ${points.length} days. Average ${avg !== null ? format(avg) : 'none'}.`}>
        <Text style={styles.footerSelected}>
          {selected ? dayName(selected.date, selectedIndex === lastIndex) : ''}
        </Text>
        {avg !== null ? <Text style={styles.footerAvg}>avg {format(avg)}</Text> : null}
      </View>
    </View>
  );
}

function dayName(date: string, isToday: boolean): string {
  if (isToday) return 'Today';
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function Bar({
  point,
  index,
  isSelected,
  isToday,
  max,
  color,
  height,
  format,
  onPress,
}: {
  point: Point;
  index: number;
  isSelected: boolean;
  isToday: boolean;
  max: number;
  color: string;
  height: number;
  format: (value: number) => string;
  onPress: () => void;
}) {
  const grow = useAnimatedTarget(point.value !== null ? 1 : 0, motion.bars, index * motion.barStagger);
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }] }));
  const barHeight = point.value !== null ? Math.max((point.value / max) * height, 3) : 0;
  const valueText = point.value !== null ? format(point.value) : 'no data';

  return (
    <Pressable
      style={styles.col}
      onPress={onPress}
      disabled={point.value === null}
      accessibilityRole="button"
      accessibilityLabel={`${dayName(point.date, isToday)}: ${valueText}`}
      accessibilityState={{ selected: isSelected }}>
      <View style={[styles.track, { height: height + VALUE_ROW }, isSelected && styles.trackSelected]}>
        {point.value !== null ? (
          <>
            {isSelected ? (
              <View style={styles.valueWrap}>
                <Text style={styles.value} numberOfLines={1}>
                  {valueText}
                </Text>
              </View>
            ) : null}
            <Animated.View style={[{ height: barHeight }, styles.bar, barStyle]}>
              <LinearGradient colors={gradientFor(color)} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </>
        ) : null}
      </View>
      <Text style={[styles.day, isSelected && styles.daySelected]}>{shortDay(point.date)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  col: { flex: 1, alignItems: 'stretch', gap: 6 },
  track: { justifyContent: 'flex-end', borderRadius: 4 },
  trackSelected: { backgroundColor: colors.track },
  bar: { borderRadius: 4, overflow: 'hidden', transformOrigin: 'bottom' },
  // Wider than the bar and centered on it, so labels like "14.2" or "100%" never get cut off.
  valueWrap: { alignItems: 'center', marginBottom: 4, marginHorizontal: -16 },
  value: { color: colors.text, fontFamily: fonts.number, fontSize: 14, fontVariant: ['tabular-nums'] },
  day: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11, textAlign: 'center' },
  daySelected: { color: colors.text, fontFamily: fonts.bodySemi },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  footerSelected: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 12 },
  footerAvg: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12 },
});
