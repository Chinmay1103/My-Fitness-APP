import { useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors, fonts, gradientFor, motion } from '@/constants/theme';
import { useAnimatedTarget } from '@/lib/animation';
import { shortDay } from '@/lib/format';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  /** What's charted, for screen readers, e.g. "Strain". */
  label: string;
  points: { date: string; value: number | null }[];
  min?: number;
  max: number;
  color: string;
  height?: number;
  format?: (value: number) => string;
}

const PAD_TOP = 22; // room for today's value label
const PAD_X = 8;

/**
 * Smooth area chart for a daily trend. The line draws itself in, the fill fades up under it,
 * today's point is marked with its value and a dashed line shows the period's average.
 */
export function TrendLine({ label, points, min = 0, max, color, height = 120, format = (v) => v.toFixed(1) }: Props) {
  const [width, setWidth] = useState(0);
  const [light, dark] = gradientFor(color);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  const draw = useAnimatedTarget(width > 0 ? 1 : 0, motion.chart);

  const n = points.length;
  const x = (i: number) => PAD_X + (n > 1 ? (i / (n - 1)) * (width - PAD_X * 2) : 0);
  const y = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * (height - PAD_TOP);
  const known = points.flatMap((p, i) => (p.value !== null ? [{ i, v: p.value, px: x(i), py: y(p.value) }] : []));

  // Curve with horizontal tangents at each point: smooth, and never overshoots a real value.
  let line = '';
  let length = 0;
  known.forEach((p, k) => {
    if (k === 0) {
      line = `M${p.px},${p.py}`;
      return;
    }
    const prev = known[k - 1];
    const midX = (prev.px + p.px) / 2;
    line += ` C${midX},${prev.py} ${midX},${p.py} ${p.px},${p.py}`;
    length += Math.hypot(p.px - prev.px, p.py - prev.py);
  });
  // The chord sum slightly underestimates the curve length; pad it so the dash covers the whole line.
  length = length * 1.15 + 1;
  const first = known[0];
  const last = known.at(-1);
  const area = first && last ? `${line} L${last.px},${height} L${first.px},${height} Z` : '';

  const avg = known.length ? known.reduce((s, p) => s + p.v, 0) / known.length : null;

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }));
  const areaProps = useAnimatedProps(() => ({ fillOpacity: draw.value }));
  // Today's dot pops in once the line reaches it.
  const haloProps = useAnimatedProps(() => ({ opacity: draw.value > 0.95 ? 0.2 : 0 }));
  const dotProps = useAnimatedProps(() => ({ opacity: draw.value > 0.95 ? 1 : 0 }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: draw.value > 0.95 ? 1 : 0 }));

  const today = points.at(-1)?.value;

  return (
    <View
      accessible
      accessibilityLabel={`${label}, last ${n} days. Average ${avg !== null ? format(avg) : 'none'}, today ${
        today != null ? format(today) : 'no data'
      }.`}>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && known.length > 1 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id={`fill${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={dark} stopOpacity={0.35} />
                <Stop offset="1" stopColor={dark} stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id={`line${id}`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={dark} />
                <Stop offset="1" stopColor={light} />
              </LinearGradient>
            </Defs>
            {avg !== null ? (
              <Line
                x1={PAD_X}
                x2={width - PAD_X}
                y1={y(avg)}
                y2={y(avg)}
                stroke={colors.text}
                strokeOpacity={0.3}
                strokeDasharray="3 4"
              />
            ) : null}
            <AnimatedPath d={area} fill={`url(#fill${id})`} animatedProps={areaProps} />
            <AnimatedPath
              d={line}
              stroke={`url(#line${id})`}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${length} ${length}`}
              animatedProps={lineProps}
            />
            {known.slice(0, -1).map((p) => (
              <Circle key={p.i} cx={p.px} cy={p.py} r={2.5} fill={colors.card} stroke={dark} strokeWidth={1.5} />
            ))}
            {last ? (
              <>
                <AnimatedCircle cx={last.px} cy={last.py} r={9} fill={light} animatedProps={haloProps} />
                <AnimatedCircle
                  cx={last.px}
                  cy={last.py}
                  r={4.5}
                  fill={light}
                  stroke={colors.card}
                  strokeWidth={2}
                  animatedProps={dotProps}
                />
              </>
            ) : null}
          </Svg>
        ) : null}
        {last && width > 0 ? (
          <Animated.Text style={[styles.todayValue, { left: Math.min(last.px - 30, width - 60), top: Math.max(last.py - 24, 0) }, labelStyle]}>
            {format(last.v)}
          </Animated.Text>
        ) : null}
      </View>
      <View style={[styles.days, { paddingHorizontal: PAD_X - 6 }]}>
        {points.map((p, i) => (
          <Text key={p.date} style={[styles.day, i === n - 1 && styles.dayToday]}>
            {shortDay(p.date)}
          </Text>
        ))}
      </View>
      {avg !== null ? <Text style={styles.avg}>avg {format(avg)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  todayValue: {
    position: 'absolute',
    width: 60,
    textAlign: 'center',
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 15,
  },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  day: { width: 12, textAlign: 'center', color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11 },
  dayToday: { color: colors.text, fontFamily: fonts.bodySemi },
  avg: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11, textAlign: 'right', marginTop: 6 },
});
