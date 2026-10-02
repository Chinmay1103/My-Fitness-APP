import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
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

import { colors, timeOfDay, withAlpha, type TimeOfDay } from '@/constants/theme';
import { useHour } from '@/lib/useHour';

/** Public-domain / CC0 photos at full phone resolution (1200 x 2600); sources in assets/scenes/CREDITS.md. */
const SCENES: Record<TimeOfDay, number> = {
  dawn: require('@/assets/scenes/dawn.webp'),
  day: require('@/assets/scenes/day.webp'),
  dusk: require('@/assets/scenes/dusk.webp'),
  night: require('@/assets/scenes/night.webp'),
};

/**
 * Where each photo's best part is (mountain, horizon), as a fraction of its height. The photo is
 * lifted so that point lands at FOCUS_AT of the screen, in the open space at the top instead of
 * behind the cards further down.
 */
const FOCUS: Record<TimeOfDay, number> = { dawn: 0.32, day: 0.28, dusk: 0.56, night: 0.52 };
const FOCUS_AT = 0.3;

/** One slow push-in and back, ms. */
const DRIFT_MS = 40000;

/**
 * The "Scenes" background: a mountain photo for the time of day (dawn, day, dusk, night),
 * drifting very slowly under three gradients: the screen's color washing in from the top left, a
 * fade that keeps the photo vivid near the top and sinks into the dark page lower down (where the
 * cards are, so white text stays readable), and a faint glow of the time-of-day color at the
 * bottom. Still when "reduce motion" is on.
 */
export function SceneBackdrop({ color }: { color: string }) {
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const scene = timeOfDay(useHour(focused));
  const clock = colors.timeOfDay[scene];
  const { height } = useWindowDimensions();
  // Only ever lift the photo; pushing it down would leave a gap at the top.
  const lift = Math.min(0, (FOCUS_AT - FOCUS[scene]) * height);
  const t = useSharedValue(0);

  useEffect(() => {
    if (!focused || reduced) {
      cancelAnimation(t);
      return;
    }
    t.value = withRepeat(withTiming(1, { duration: DRIFT_MS, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [focused, reduced, t]);

  const drift = useAnimatedStyle(() => ({
    // Stays under the photo's own 1200 px width on a typical phone, so it never gets blurry.
    transform: [{ scale: 1.04 + 0.04 * t.value }, { translateX: -8 + 16 * t.value }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.Image
        source={SCENES[scene]}
        resizeMode="cover"
        resizeMethod="scale"
        style={[{ position: 'absolute', left: 0, right: 0, top: lift, height }, drift]}
      />
      <LinearGradient
        colors={[withAlpha(color, 0.24), withAlpha(color, 0.06), 'transparent']}
        locations={[0, 0.3, 0.6]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 0.65 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Clear over the photo's best part, then sinking into the page well before the photo ends. */}
      <LinearGradient
        colors={[
          withAlpha(colors.background, 0.4),
          withAlpha(colors.background, 0.05),
          withAlpha(colors.background, 0.15),
          withAlpha(colors.background, 0.7),
          withAlpha(colors.background, 0.97),
        ]}
        locations={[0, 0.16, 0.42, 0.66, 0.84]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', withAlpha(clock, 0.2)]}
        locations={[0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
