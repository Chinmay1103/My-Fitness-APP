import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import { useEffect, useId } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { motion, timeOfDayTint, withAlpha } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { useHour } from '@/lib/useHour';

interface Props {
  /** The screen's main color, e.g. today's recovery zone. Brightest light, top left. */
  color: string;
  /** Second light, lower down; defaults to the time-of-day color. */
  second?: string;
  /** 0–1 multiplier on how bright the lights are. */
  strength?: number;
}

/**
 * The moving background behind every screen: three soft lights drifting slowly over the near-black
 * page, so the glass cards always have something to show through. One light is the screen's color,
 * one follows the time of day (see `timeOfDayTint`). Stops moving when the screen isn't visible
 * and stays still when the phone's "reduce motion" setting is on.
 */
export function Aurora({ color, second, strength = 1 }: Props) {
  const { width, height } = useWindowDimensions();
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const hour = useHour(focused);
  const animate = focused && !reduced;

  const colors = useColors();
  const clock = timeOfDayTint(hour, colors);
  const size = width * 1.35;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* A faint wash of the main color at the top, so the page is never flat black. */}
      <LinearGradient
        colors={[withAlpha(color, 0.16 * strength), withAlpha(color, 0.03 * strength), 'transparent']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Light color={color} opacity={0.42 * strength} size={size} x={-size * 0.35} y={-size * 0.4} drift={width * 0.18} period={motion.aurora} animate={animate} />
      <Light color={second ?? clock} opacity={0.3 * strength} size={size} x={width - size * 0.6} y={height * 0.3} drift={width * 0.22} period={motion.aurora * 1.4} animate={animate} />
      <Light color={second ? clock : colors.sleep} opacity={0.22 * strength} size={size * 0.9} x={-size * 0.3} y={height * 0.72} drift={width * 0.16} period={motion.aurora * 1.9} animate={animate} />
    </View>
  );
}

function Light({
  color,
  opacity,
  size,
  x,
  y,
  drift,
  period,
  animate,
}: {
  color: string;
  opacity: number;
  size: number;
  x: number;
  y: number;
  /** How far it wanders from its starting point, in points. */
  drift: number;
  /** Time for one wander out and back, ms. */
  period: number;
  animate: boolean;
}) {
  const styles = useStyles();
  const id = `light${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const t = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      cancelAnimation(t);
      return;
    }
    // A slow loop 0 → 1 → 0; the path below turns it into a lazy figure-eight with a gentle pulse.
    // An even number of passes, so each light ends where it started.
    const passes = 2 * Math.max(1, Math.round(motion.backgroundMotion / period / 2));
    t.value = withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), passes, true);
    return () => cancelAnimation(t);
  }, [animate, period, t]);

  const style = useAnimatedStyle(() => {
    const a = t.value * Math.PI * 2;
    return {
      transform: [
        { translateX: x + Math.sin(a) * drift },
        { translateY: y + Math.sin(a * 2) * drift * 0.5 },
        { scale: 1 + 0.12 * Math.sin(a) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.light, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.45" stopColor={color} stopOpacity={opacity * 0.45} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  light: { position: 'absolute', top: 0, left: 0 },
}));
