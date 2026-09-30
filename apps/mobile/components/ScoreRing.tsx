import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/constants/theme';

interface Props {
  label: string;
  /** Text shown in the middle, e.g. "72%" or "13.4". */
  display: string;
  /** How full the ring is, 0 to 1. */
  progress: number;
  color: string;
  size?: number;
  /** Makes the ring tappable, e.g. to open an explanation of the score. */
  onPress?: () => void;
}

export function ScoreRing({ label, display, progress, color, size = 104, onPress }: Props) {
  const stroke = size * 0.09;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(Math.max(progress, 0), 1) * circumference;

  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label} ${display}`}
      accessibilityHint={onPress ? 'Shows how this score was worked out' : undefined}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.track} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            // Start the ring at 12 o'clock instead of 3 o'clock.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={[styles.value, { fontSize: size * 0.22 }]}>{display}</Text>
        </View>
      </View>
      <Text style={styles.label}>
        {label}
        {onPress ? '  ›' : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.6, transform: [{ scale: 0.97 }] },
  center: { alignItems: 'center', justifyContent: 'center' },
  value: { color: colors.text, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 1 },
});
