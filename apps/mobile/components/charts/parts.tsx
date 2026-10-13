import { useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { fonts, motion } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { useAnimatedTarget } from '@/lib/animation';
import { tapHaptic } from '@/lib/haptics';
import { useScores } from '@/lib/ScoresProvider';

/**
 * Pieces every chart shares, so they all look and behave the same: drag-to-scrub, the 7D/14D/30D
 * switch, the readout above the plot, a left-to-right reveal and smooth lines. Charts draw with
 * react-native-svg into one canvas each, which keeps them light even at 30 days.
 */

/** The part of a chart on screen, as fractions of the whole: { lo: 0, hi: 1 } is zoomed all the way out. */
export interface ZoomView {
  lo: number;
  hi: number;
}

export const FULL_VIEW: ZoomView = { lo: 0, hi: 1 };

/**
 * Touch handling for a chart: tap or drag sideways with one finger to scrub, up/down still scrolls
 * the page, and two fingers pinch to zoom in on part of it (and slide sideways while zoomed).
 * `onScrub` gets the finger's position across the *whole* chart, 0 (left) to just under 1 (right),
 * whatever the zoom; draw with `view` to show only the zoomed part. `minSpan` is the furthest you
 * can zoom in, as a fraction of the whole. Spread `scrubProps` on the View that wraps the plot; its
 * children should ignore touches.
 */
export function useScrub(onScrub: (fraction: number) => void, { minSpan = 1 }: { minSpan?: number } = {}) {
  const [width, setWidth] = useState(0);
  const [view, setViewState] = useState<ZoomView>(FULL_VIEW);
  const ref = useRef({
    onScrub,
    minSpan,
    width: 0,
    pageLeft: 0,
    view: FULL_VIEW,
    pinch: null as null | { distance: number; start: ZoomView; anchor: number },
    setView: (v: ZoomView) => {
      ref.current.view = v;
      setViewState(v);
    },
  });
  ref.current.onScrub = onScrub;
  ref.current.minSpan = Math.min(minSpan, 1);

  const pan = useMemo(() => {
    const r = ref.current;
    const emit = (x: number) => {
      if (r.width <= 0) return;
      const f = Math.min(Math.max(x / r.width, 0), 0.9999);
      r.onScrub(Math.min(r.view.lo + f * (r.view.hi - r.view.lo), 0.9999));
    };
    // Keeps the point that was between the fingers when the pinch began under the fingers' midpoint,
    // so pinching zooms around them and sliding both fingers pans.
    const pinchMove = (x1: number, x2: number) => {
      const mid = Math.min(Math.max(((x1 + x2) / 2 - r.pageLeft) / r.width, 0), 1);
      const distance = Math.max(Math.abs(x1 - x2), 24);
      if (!r.pinch) {
        r.pinch = { distance, start: r.view, anchor: r.view.lo + mid * (r.view.hi - r.view.lo) };
        return;
      }
      const startSpan = r.pinch.start.hi - r.pinch.start.lo;
      const span = Math.min(Math.max((startSpan * r.pinch.distance) / distance, r.minSpan), 1);
      if (span >= 0.999) {
        if (r.view !== FULL_VIEW) r.setView(FULL_VIEW);
        return;
      }
      const lo = Math.min(Math.max(r.pinch.anchor - mid * span, 0), 1 - span);
      r.setView({ lo, hi: lo + span });
    };
    const canZoom = () => r.minSpan < 1 && r.width > 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e, g) => (canZoom() && e.nativeEvent.touches.length >= 2) || Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => {
        r.pageLeft = e.nativeEvent.pageX - e.nativeEvent.locationX;
        r.pinch = null;
        if (e.nativeEvent.touches.length < 2) emit(e.nativeEvent.locationX);
      },
      // Measured from the page edge, not locationX, which can jump between views.
      onPanResponderMove: (e) => {
        const touches = e.nativeEvent.touches;
        if (canZoom() && touches.length >= 2) {
          pinchMove(touches[0].pageX, touches[1].pageX);
          return;
        }
        // One finger left over from a pinch: don't let it jump the picked day.
        if (r.pinch) return;
        emit(e.nativeEvent.pageX - r.pageLeft);
      },
      onPanResponderRelease: () => {
        r.pinch = null;
      },
      onPanResponderTerminate: () => {
        r.pinch = null;
      },
      onPanResponderTerminationRequest: (_, g) => !r.pinch && Math.abs(g.dy) > Math.abs(g.dx),
    });
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    ref.current.width = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };
  const zoomed = view.hi - view.lo < 0.999;
  return {
    width,
    view,
    zoomed,
    resetZoom: () => ref.current.setView(FULL_VIEW),
    scrubProps: { ...pan.panHandlers, onLayout },
  };
}

/**
 * Shows only the zoomed part of whatever's inside: the children are laid out `1 / span` times
 * wider than the chart and slid left, so flex rows of bars and labels zoom with no extra math.
 */
export function ZoomStrip({ width, view, children }: { width: number; view: ZoomView; children: ReactNode }) {
  const inner = width / (view.hi - view.lo);
  return (
    <View style={{ width, overflow: 'hidden' }}>
      <View style={{ width: inner, marginLeft: -view.lo * inner }}>{children}</View>
    </View>
  );
}

/** "Pinch to zoom", or a button back out once zoomed in. */
export function ZoomHint({ zoomed, onReset }: { zoomed: boolean; onReset: () => void }) {
  const styles = useStyles();
  if (!zoomed) return <Text style={styles.openHint}>Pinch to zoom</Text>;
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onReset();
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Zoom back out"
      style={({ pressed }) => [styles.openLink, pressed && { opacity: 0.6 }]}>
      <Text style={styles.openLinkText}>Zoom out</Text>
    </Pressable>
  );
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

/**
 * Under every day-by-day chart: once you scrub to a day other than the one the screen shows, a
 * link that switches the whole screen (and Today, Sleep, Strain, Recovery) to that day, so any bar
 * leads to that day's full report. `back` counts days back from the latest, like `dayBack`.
 */
export function OpenDayLink({ back, date, zoom }: { back: number; date?: string; zoom?: { zoomed: boolean; onReset: () => void } }) {
  const styles = useStyles();
  const { dayBack, setDayBack } = useScores();
  const showing = back === dayBack;
  const link =
    !date || showing ? (
      <Text style={styles.openHint}>{zoom && !zoom.zoomed ? 'Drag to pick a day · pinch to zoom' : 'Drag across the chart to pick a day'}</Text>
    ) : (
      <DayLink label={`Show ${dayName(date, back === 0)} above  ↑`} onOpen={() => setDayBack(back)} />
    );
  if (!zoom || (!zoom.zoomed && (!date || showing))) return link;
  return (
    <View style={styles.hintRow}>
      {link}
      <ZoomHint {...zoom} />
    </View>
  );
}

function DayLink({ label, onOpen }: { label: string; onOpen: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onOpen();
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityHint="Switches the screen above to this day"
      style={({ pressed }) => [styles.openLink, pressed && { opacity: 0.6 }]}>
      <Text style={styles.openLinkText}>{label}</Text>
    </Pressable>
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
  openHint: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11 },
  hintRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  openLink: { alignSelf: 'flex-start', borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  openLinkText: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendMark: { width: 12, height: 4, borderRadius: 2 },
  legendText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12 },
}));
