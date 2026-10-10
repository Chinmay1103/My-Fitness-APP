import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { fonts, gradientFor, motion, spacing, type } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { useAnimatedTarget } from '@/lib/animation';
import { tapHaptic } from '@/lib/haptics';


/**
 * "Start value, then what each factor added or took off, then the result" list.
 * Used to show how every score was reached.
 */
export function Breakdown({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.list}>{children}</View>;
}

/** The starting point (e.g. "Typical night for you: 57%") or the final result. */
export function BreakdownTotal({ label, value, color, detail }: { label: string; value: string; color?: string; detail?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.total}>
      <View style={styles.text}>
        <Text style={styles.totalLabel}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      <Text style={[styles.totalValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

interface FactorProps {
  label: string;
  /** Plain-language explanation, e.g. "58 ms vs your usual 52 ms". */
  detail: string;
  /** Points added (positive) or taken off (negative). */
  delta: number;
  /** Largest |delta| on the list, to scale the bars. */
  scale: number;
  decimals?: number;
  unit?: string;
  /** Fixed color, for lists where more isn't good or bad (strain, minutes of sleep need). */
  color?: string;
  /** Makes the row tappable (with a chevron), e.g. to open the activity or metric behind it. */
  onPress?: () => void;
}

export function BreakdownFactor({ label, detail, delta, scale, decimals = 0, unit = '', color: fixedColor, onPress }: FactorProps) {
  const colors = useColors();
  const styles = useStyles();
  const rounded = Number(delta.toFixed(decimals));
  const color = rounded === 0 ? colors.muted : fixedColor ? fixedColor : rounded > 0 ? colors.recovery.green : colors.recovery.red;
  const [light, dark] = gradientFor(color, colors);
  const fraction = Math.min(Math.abs(delta) / Math.max(scale, 1e-6), 1);
  const grow = useAnimatedTarget(1, motion.bars, 150);
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±';
  const row = (
    <View style={styles.factor}>
      <View style={styles.factorTop}>
        <View style={styles.text}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
        <Text style={[styles.delta, { color }]}>
          {sign}
          {Math.abs(rounded).toFixed(decimals)}
          {unit}
        </Text>
        {onPress ? <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={colors.muted} size={16} /> : null}
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, { width: `${fraction * 100}%` }, barStyle]}>
          <LinearGradient colors={[dark, light]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
    </View>
  );
  if (!onPress) return row;
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${detail}. Open details.`}
      style={({ pressed }) => pressed && styles.pressed}>
      {row}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  list: { gap: spacing.md },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 2 },
  total: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  totalLabel: { ...type.bodyStrong, color: colors.text },
  totalValue: { fontFamily: fonts.number, fontSize: 26, color: colors.text },
  factor: { gap: 8, paddingLeft: spacing.sm + 2, borderLeftWidth: 2, borderLeftColor: colors.border },
  factorTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  detail: { ...type.caption, lineHeight: 17, color: colors.muted },
  delta: { fontFamily: fonts.number, fontSize: 20, minWidth: 52, textAlign: 'right' },
  track: { height: 6, flexDirection: 'row', backgroundColor: colors.track, borderRadius: 3, overflow: 'hidden' },
  bar: { borderRadius: 3, overflow: 'hidden', transformOrigin: 'left' },
}));
