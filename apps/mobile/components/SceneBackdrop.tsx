import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { PixelRatio, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { motion, timeOfDay, withAlpha, type TimeOfDay } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { useHour } from '@/lib/useHour';

type Scene = {
  source: number;
  /** The photo's size in pixels. */
  width: number;
  height: number;
  /** Where its subject is, as fractions of the photo's width and height. */
  focusX: number;
  focusY: number;
};

/**
 * Chinmay's photos, uncropped (at most 2048 px on the long side: Android halves anything bigger
 * before drawing it). They're fitted to the actual screen at runtime by `fitScene`, so any phone
 * shape gets its own crop. Sources in assets/scenes/CREDITS.md.
 */
const SCENES: Record<TimeOfDay, Scene> = {
  dawn: { source: require('@/assets/scenes/dawn.webp'), width: 1080, height: 1920, focusX: 0.6, focusY: 0.55 },
  day: { source: require('@/assets/scenes/day.webp'), width: 1536, height: 2048, focusX: 0.3, focusY: 0.52 },
  dusk: { source: require('@/assets/scenes/dusk.webp'), width: 1365, height: 2048, focusX: 0.62, focusY: 0.58 },
  night: { source: require('@/assets/scenes/night.webp'), width: 1152, height: 2048, focusX: 0.5, focusY: 0.5 },
};

/** How far the photo drifts each way, in screen points. */
const DRIFT = 6;
/** Where the subject should land, as a fraction of the screen's height (above the cards). */
const TARGET_Y = 0.36;
/** Extra zoom allowed beyond "just covers the screen" to lift the subject towards TARGET_Y. */
const MAX_EXTRA_ZOOM = 1.3;
/** How much a photo pixel may be stretched across screen pixels before it looks soft. */
const MAX_UPSCALE = 1.15;

/**
 * Sizes and places the photo for a screen of `w` x `h` points: covers it (with room to drift),
 * then zooms in a little and slides so the subject sits high on the screen, without zooming so
 * far that the photo turns blurry, and never showing an edge.
 */
export function fitScene(scene: Scene, w: number, h: number, pixelRatio: number) {
  const cover = Math.max((w + 2 * DRIFT) / scene.width, h / scene.height);
  // Zoom at which the subject can sit at TARGET_Y with the photo's bottom edge at the screen's.
  const lift = (h * (1 - TARGET_Y)) / ((1 - scene.focusY) * scene.height);
  const sharp = MAX_UPSCALE / pixelRatio;
  const scale = Math.max(cover, Math.min(lift, cover * MAX_EXTRA_ZOOM, sharp));
  const width = scene.width * scale;
  const height = scene.height * scale;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    width,
    height,
    left: clamp(w / 2 - scene.focusX * width, w + DRIFT - width, -DRIFT),
    top: clamp(h * TARGET_Y - scene.focusY * height, h - height, 0),
  };
}

/** One slow push-in and back, ms. */
const DRIFT_MS = 40000;

/**
 * The "Scenes" background: a photo for the time of day (dawn, day, dusk, night),
 * drifting very slowly under three gradients: the screen's color washing in from the top left, a
 * fade that keeps the photo vivid near the top and sinks into the dark page lower down (where the
 * cards are, so white text stays readable), and a faint glow of the time-of-day color at the
 * bottom. Still when "reduce motion" is on.
 */
export function SceneBackdrop({ color }: { color: string }) {
  const colors = useColors();
  const styles = useStyles();
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const scene = timeOfDay(useHour(focused));
  const clock = colors.timeOfDay[scene];
  const t = useSharedValue(0);
  // Start from the window size, then use the backdrop's own measured size (rotation, split screen).
  const win = useWindowDimensions();
  const [size, setSize] = useState({ w: win.width, h: win.height });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0 && (width !== size.w || height !== size.h)) setSize({ w: width, h: height });
  };
  const fit = fitScene(SCENES[scene], size.w, size.h, PixelRatio.get());

  useEffect(() => {
    if (!focused || reduced) {
      cancelAnimation(t);
      return;
    }
    const passes = Math.max(2, Math.round(motion.backgroundMotion / DRIFT_MS));
    t.value = withRepeat(withTiming(1, { duration: DRIFT_MS, easing: Easing.inOut(Easing.sin) }), passes, true);
    return () => cancelAnimation(t);
  }, [focused, reduced, t]);

  const drift = useAnimatedStyle(() => ({
    // A slow sideways drift; fitScene leaves DRIFT points of photo past each side for it.
    transform: [{ translateX: -DRIFT + 2 * DRIFT * t.value }],
  }));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]} onLayout={onLayout}>
      <Animated.Image
        source={SCENES[scene].source}
        resizeMode="cover"
        // Never let Android shrink the photo before drawing it; at <= 2048 px it wouldn't anyway.
        resizeMethod="none"
        style={[styles.photo, fit, drift]}
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
          withAlpha(colors.background, 0.6),
          withAlpha(colors.background, 0.18),
          withAlpha(colors.background, 0.15),
          withAlpha(colors.background, 0.7),
          withAlpha(colors.background, 0.97),
        ]}
        locations={[0, 0.13, 0.42, 0.66, 0.84]}
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

const useStyles = makeStyles((colors) => StyleSheet.create({
  clip: { overflow: 'hidden' },
  photo: { position: 'absolute' },
}));
