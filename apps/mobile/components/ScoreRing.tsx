import { StyleSheet, Text, View } from 'react-native';
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
}

export function ScoreRing({ label, display, progress, color, size = 104 }: Props) {
  const stroke = size * 0.09;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(Math.max(progress, 0), 1) * circumference;

  return (
    <View style={styles.wrap} accessibilityLabel={`${label} ${display}`}>
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
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  center: { alignItems: 'center', justifyContent: 'center' },
  value: { color: colors.text, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 1 },
});
