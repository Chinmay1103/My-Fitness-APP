import { useId } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors, fonts, gradientFor, motion } from '@/constants/theme';
import { useAnimatedTarget, useCountUp } from '@/lib/animation';
import { tapHaptic } from '@/lib/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  label: string;
  /** Number shown in the middle; null shows "--". */
  value: number | null;
  decimals?: number;
  /** Appended to the number, e.g. "%". */
  suffix?: string;
  /** How full the ring is, 0 to 1. */
  progress: number;
  /** Flat score color; the ring uses the matching gradient from the theme. */
  color: string;
  size?: number;
  /** Makes the ring tappable, e.g. to open an explanation of the score. */
  onPress?: () => void;
}

export function ScoreRing({ label, value, decimals = 0, suffix = '', progress, color, size = 104, onPress }: Props) {
  const stroke = size * 0.09;
  const glowWidth = stroke * 1.6;
  // Leave room for the glow so it isn't clipped at the edge.
  const radius = (size - glowWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = Math.min(Math.max(progress, 0), 1);
  const [light, dark] = gradientFor(color);
  const gradientId = `ring${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  // The ring fills from 12 o'clock and the number counts up with it.
  const filled = useAnimatedTarget(target, motion.ring);
  const counted = useCountUp(value ?? 0, motion.countUp);
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - filled.value) }));
  const glowProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - filled.value) }));

  const display = value === null ? '--' : `${counted.toFixed(decimals)}${suffix}`;
  const finalDisplay = value === null ? '--' : `${value.toFixed(decimals)}${suffix}`;
  const center = size / 2;
  const rotate = `rotate(-90 ${center} ${center})`;

  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      onPress={
        onPress
          ? () => {
              tapHaptic();
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
      hitSlop={8}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label} ${finalDisplay}`}
      accessibilityHint={onPress ? 'Shows how this score was worked out' : undefined}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={light} />
              <Stop offset="1" stopColor={dark} />
            </LinearGradient>
          </Defs>
          <Circle cx={center} cy={center} r={radius} stroke={colors.track} strokeWidth={stroke} fill="none" />
          {target > 0 ? (
            <>
              {/* Soft glow: the same arc, wider and faint. */}
              <AnimatedCircle
                cx={center}
                cy={center}
                r={radius}
                stroke={dark}
                strokeOpacity={0.16}
                strokeWidth={glowWidth}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                animatedProps={glowProps}
                transform={rotate}
              />
              <AnimatedCircle
                cx={center}
                cy={center}
                r={radius}
                stroke={`url(#${gradientId})`}
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                animatedProps={arcProps}
                transform={rotate}
              />
            </>
          ) : null}
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={[styles.value, { fontSize: size * 0.27 }]} numberOfLines={1} adjustsFontSizeToFit>
            {display}
          </Text>
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
  wrap: { alignItems: 'center', gap: 8, minWidth: 48 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  value: { color: colors.text, fontFamily: fonts.display, fontVariant: ['tabular-nums'] },
  label: { color: colors.muted, fontFamily: fonts.displaySemi, fontSize: 13, letterSpacing: 1.4 },
});
