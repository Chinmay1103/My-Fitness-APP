import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { timeOfDay, withAlpha, type TimeOfDay } from '@/constants/theme';
import { useHour } from '@/lib/useHour';

/** Public-domain / CC0 photos, about 40–90 KB each; sources in assets/scenes/CREDITS.md. */
const SCENES: Record<TimeOfDay, number> = {
  dawn: require('@/assets/scenes/dawn.webp'),
  day: require('@/assets/scenes/day.webp'),
  dusk: require('@/assets/scenes/dusk.webp'),
  night: require('@/assets/scenes/night.webp'),
};

/** One slow push-in and back, ms. */
const DRIFT_MS = 40000;

/**
 * The "Scenes" background: a mountain photo for the time of day (dawn, day, dusk, night),
 * drifting very slowly, washed with the screen's color at the top and darkened towards the bottom
 * so white text on the glass cards stays easy to read. Still when "reduce motion" is on.
 */
export function SceneBackdrop({ color }: { color: string }) {
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const scene = timeOfDay(useHour(focused));
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
    transform: [{ scale: 1.06 + 0.06 * t.value }, { translateX: -10 + 20 * t.value }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.Image source={SCENES[scene]} resizeMode="cover" style={[StyleSheet.absoluteFill, drift]} />
      <LinearGradient
        colors={[withAlpha(color, 0.3), withAlpha(color, 0.08), 'transparent']}
        locations={[0, 0.35, 0.6]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        // Darkest at the very top (titles) and bottom (tab bar); the daytime sky is bright.
        colors={['rgba(5,5,5,0.55)', 'rgba(5,5,5,0.42)', 'rgba(5,5,5,0.5)', 'rgba(5,5,5,0.68)']}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
