import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import { colors, fonts, motion, spacing } from '@/constants/theme';
import { useAnimatedTarget } from '@/lib/animation';
import { tapHaptic } from '@/lib/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
  /** Right-hand text in the legend, e.g. "1h 24m". */
  valueText: string;
}

interface Props {
  slices: Slice[];
  /** Big text in the middle, e.g. "7h 32m". */
  center: string;
  centerLabel: string;
  size?: number;
}

const GAP_DEG = 3;

/**
 * Share-of-the-whole chart: a ring cut into slices, with a legend whose rows (or the slices) you
 * tap to bring one forward and see its share in the middle. Slices sweep in together on first show.
 */
/** Room the legend next to the donut needs: dot, stage name, time and share. */
const LEGEND_MIN = 175;

export function Donut({ slices, center, centerLabel, size: maxSize = 132 }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  // On narrow phones the donut shrinks so the legend keeps its room (card inside ≈ screen − 70).
  const { width } = useWindowDimensions();
  const size = Math.max(88, Math.min(maxSize, width - 2 * spacing.md - 2 * (spacing.md + 3) - 18 - LEGEND_MIN));
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const stroke = size * 0.13;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sweep = useAnimatedTarget(1, motion.ring);
  const pickedSlice = slices.find((s) => s.key === picked);

  const toggle = (key: string) => {
    tapHaptic();
    setPicked((p) => (p === key ? null : key));
  };

  let angle = -90;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const deg = (s.value / total) * 360;
      const arc = { slice: s, start: angle, deg: Math.max(deg - GAP_DEG, 0.5) };
      angle += deg;
      return arc;
    });

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {arcs.map(({ slice, start, deg }) => (
            <G key={slice.key} rotation={start} origin={`${size / 2}, ${size / 2}`}>
              <Arc
                size={size}
                r={r}
                c={c}
                stroke={stroke}
                color={slice.color}
                length={(deg / 360) * c}
                sweep={sweep}
                dim={picked !== null && picked !== slice.key}
                onPress={() => toggle(slice.key)}
              />
            </G>
          ))}
        </Svg>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={[styles.centerValue, pickedSlice && { color: pickedSlice.color }]}>
            {pickedSlice ? `${Math.round((pickedSlice.value / total) * 100)}%` : center}
          </Text>
          <Text style={styles.centerLabel}>{pickedSlice ? pickedSlice.label.toLowerCase() : centerLabel}</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {slices.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => toggle(s.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: picked === s.key }}
            accessibilityLabel={`${s.label}: ${s.valueText}, ${Math.round((s.value / total) * 100)} percent`}
            style={[styles.row, picked !== null && picked !== s.key && styles.dim]}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.rowLabel}>{s.label}</Text>
            <Text style={styles.rowValue}>{s.valueText}</Text>
            <Text style={styles.rowPct}>{Math.round((s.value / total) * 100)}%</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Arc({
  size,
  r,
  c,
  stroke,
  color,
  length,
  sweep,
  dim,
  onPress,
}: {
  size: number;
  r: number;
  c: number;
  stroke: number;
  color: string;
  length: number;
  sweep: ReturnType<typeof useAnimatedTarget>;
  dim: boolean;
  onPress: () => void;
}) {
  // Same trick as ScoreRing: a fixed dash the slice's length, slid into view.
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - sweep.value) }));
  return (
    <AnimatedCircle
      cx={size / 2}
      cy={size / 2}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeOpacity={dim ? 0.3 : 1}
      strokeDasharray={`${length} ${c}`}
      animatedProps={props}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerValue: { color: colors.text, fontFamily: fonts.number, fontSize: 24, fontVariant: ['tabular-nums'] },
  centerLabel: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11 },
  legend: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  dim: { opacity: 0.4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { flex: 1, color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13 },
  rowValue: { color: colors.text, fontFamily: fonts.numberSemi, fontSize: 16, fontVariant: ['tabular-nums'] },
  rowPct: { width: 38, textAlign: 'right', color: colors.muted, fontFamily: fonts.numberSemi, fontSize: 15 },
});
