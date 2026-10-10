import { useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { fonts, motion } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { useAnimatedTarget } from '@/lib/animation';
import { tapHaptic } from '@/lib/haptics';

/**
 * Pieces every chart shares, so they all look and behave the same: drag-to-scrub, the 7D/14D/30D
 * switch, the readout above the plot, a left-to-right reveal and smooth lines. Charts draw with
 * react-native-svg into one canvas each, which keeps them light even at 30 days.
 */

/**
 * Touch handling for a chart: tap or drag sideways to scrub, up/down still scrolls the page.
 * `onScrub` gets the finger's position across the chart, 0 (left) to just under 1 (right).
 * Spread `scrubProps` on the View that wraps the plot; its children should ignore touches.
 */
export function useScrub(onScrub: (fraction: number) => void) {
  const [width, setWidth] = useState(0);
  const ref = useRef({ onScrub, width: 0, startX: 0 });
  ref.current.onScrub = onScrub;

  const pan = useMemo(() => {
    const emit = (x: number) => {
      const { width: w } = ref.current;
      if (w > 0) ref.current.onScrub(Math.min(Math.max(x / w, 0), 0.9999));
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => {
        ref.current.startX = e.nativeEvent.locationX;
        emit(ref.current.startX);
      },
      // Start point plus distance moved: steadier than locationX, which can jump between views.
      onPanResponderMove: (_, g) => emit(ref.current.startX + g.dx),
      onPanResponderTerminationRequest: (_, g) => Math.abs(g.dy) > Math.abs(g.dx),
    });
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    ref.current.width = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };
  return { width, scrubProps: { ...pan.panHandlers, onLayout } };
}

/**
 * The picked index of a day-by-day chart: today until you scrub, with a light tick on each new
 * day. `canPick` skips days with no data.
 */
export function usePickedDay(count: number, canPick: (i: number) => boolean = () => true) {
  const [picked, setPicked] = useState<number | null>(null);
  const index = picked !== null && picked < count ? picked : count - 1;
  const latest = useRef({ index, count, canPick });
  latest.current = { index, count, canPick };
  const pick = (i: number) => {
    const { index: current, count: n, canPick: ok } = latest.current;
    const clamped = Math.min(Math.max(i, 0), n - 1);
    if (clamped === current || !ok(clamped)) return;
    tapHaptic();
    setPicked(clamped === n - 1 ? null : clamped);
  };
  return { index, pick, reset: () => setPicked(null) };
}

export const DEFAULT_RANGES = [7, 14, 30] as const;

/** The 7D / 14D / 30D switch; `unit` "m" makes it minutes (5m / 15m / 30m). */
export function RangeSwitch({
  ranges = DEFAULT_RANGES,
  value,
  onChange,
  unit = 'D',
}: {
  ranges?: readonly number[];
  value: number;
  onChange: (r: number) => void;
  unit?: 'D' | 'm';
}) {
  const styles = useStyles();
  return (
    <View style={styles.ranges} accessibilityRole="tablist">
      {ranges.map((r) => (
        <Pressable
          key={r}
          onPress={() => {
            if (r === value) return;
            tapHaptic();
            onChange(r);
          }}
          hitSlop={6}
          accessibilityRole="tab"
          accessibilityState={{ selected: r === value }}
          accessibilityLabel={`Last ${r} ${unit === 'D' ? 'days' : 'minutes'}`}
          style={[styles.range, r === value && styles.rangeSelected]}>
          <Text style={[styles.rangeText, r === value && styles.rangeTextSelected]}>{r}{unit}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Big value on the left with a line or two under the day's name, controls on the right. */
export function ChartHeader({ value, color, title, detail, right }: { value: string; color: string; title: string; detail?: string; right?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <View style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={[styles.readoutValue, { color }]}>{value}</Text>
        <View style={styles.readoutText}>
          <Text style={styles.readoutTitle} numberOfLines={1}>
            {title}
          </Text>
          {detail ? (
            <Text style={styles.readoutDetail} numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
      {right}
    </View>
  );
}

/** Colored dot + name, for charts showing more than one thing. */
export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  const styles = useStyles();
  return (
    <View style={styles.legend}>
      {items.map((it) => (
        <View key={it.label} style={styles.legendItem}>
          <View style={[styles.legendMark, it.dashed ? { borderColor: it.color, borderWidth: 1.5, borderStyle: 'dashed', backgroundColor: 'transparent' } : { backgroundColor: it.color }]} />
          <Text style={styles.legendText}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Wipes its children in from left to right on first show (one animation for the whole chart,
 * whatever it holds). Skipped with "reduce motion", like every other animation here.
 */
export function Reveal({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const shown = useAnimatedTarget(1, motion.ring);
  const style = useAnimatedStyle(() => ({ width: shown.value * width }), [width]);
  return (
    <Animated.View style={[{ height, overflow: 'hidden' }, style]}>
      <View style={{ width, height }}>{children}</View>
    </Animated.View>
  );
}

/** "Wed, Oct 1", or "Today" for the last day. */
export function dayName(date: string, isToday: boolean): string {
  if (isToday) return 'Today';
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * A smooth line through the points that never overshoots them (monotone cubic), so a curve never
 * shows a dip or peak that isn't in the data.
 */
export function smoothPath(p: { x: number; y: number }[]): string {
  const n = p.length;
  if (n === 0) return '';
  if (n === 1) return `M${p[0].x},${p[0].y}`;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((p[i + 1].y - p[i].y) / (p[i + 1].x - p[i].x || 1));
  const m: number[] = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  let path = `M${p[0].x},${p[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (p[i + 1].x - p[i].x) / 3;
    path += ` C${p[i].x + dx},${p[i].y + m[i] * dx} ${p[i + 1].x - dx},${p[i + 1].y - m[i + 1] * dx} ${p[i + 1].x},${p[i + 1].y}`;
  }
  return path;
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  readout: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  readoutValue: { fontFamily: fonts.number, fontSize: 30, fontVariant: ['tabular-nums'] },
  readoutText: { flexShrink: 1 },
  readoutTitle: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 13 },
  readoutDetail: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  ranges: { flexDirection: 'row', backgroundColor: colors.track, borderRadius: 999, padding: 2 },
  range: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  rangeSelected: { backgroundColor: colors.text },
  rangeText: { color: colors.muted, fontFamily: fonts.bodySemi, fontSize: 11 },
  rangeTextSelected: { color: colors.background },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendMark: { width: 12, height: 4, borderRadius: 2 },
  legendText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12 },
}));
