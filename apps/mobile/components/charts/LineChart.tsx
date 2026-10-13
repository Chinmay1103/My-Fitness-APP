import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { fonts, withAlpha } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { ChartHeader, OpenDayLink, DEFAULT_RANGES, Legend, RangeSwitch, Reveal, dayName, smoothPath, usePickedDay, useScrub } from './parts';

/** The fewest days you can pinch in to. */
const MIN_DAYS = 5;

interface Point {
  date: string;
  value: number | null;
}

interface Props {
  /** What's charted, e.g. "HRV". */
  label: string;
  /** Oldest first, ending today; pass at least 30 days. */
  points: Point[];
  color: string;
  format: (v: number) => string;
  /** Whether a higher value is the good direction (HRV yes, resting HR no); only changes wording. */
  higherIsBetter: boolean;
  height?: number;
}

const PAD_Y = 10;

/**
 * A day-by-day line with a soft fill under it and a shaded band for "your normal" (the middle
 * half of your days in the period), so you see at a glance when you were outside your usual range.
 * Drag to scrub, pinch to zoom; 7D / 14D / 30D switch.
 */
export function LineChart({ label, points: all, color, format, higherIsBetter, height = 120 }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const [range, setRange] = useState<number>(DEFAULT_RANGES[2]);
  const points = all.slice(-range);
  const n = points.length;
  const { index, pick, reset } = usePickedDay(n, (i) => points[i]?.value != null);
  const { width, view, zoomed, resetZoom, scrubProps } = useScrub((f) => pick(Math.floor(f * n)), { minSpan: MIN_DAYS / n });

  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const [low, mid, high] = [q(0.25), q(0.5), q(0.75)];
  const pad = Math.max((sorted.at(-1)! - sorted[0]) * 0.15, 1);
  const min = sorted[0] - pad;
  const max = sorted.at(-1)! + pad;

  // Zoomed in, the days between view.lo and view.hi fill the width; the rest is drawn off the edges.
  const slot = width / (n * (view.hi - view.lo));
  const xAt = (i: number) => (i + 0.5 - view.lo * n) * slot;
  const first = Math.min(Math.max(Math.floor(view.lo * n), 0), n - 1);
  const last = Math.min(Math.max(Math.ceil(view.hi * n) - 1, first), n - 1);
  const yAt = (v: number) => PAD_Y + (1 - (v - min) / (max - min)) * (height - PAD_Y * 2);
  const drawn = points.flatMap((p, i) => (p.value != null ? [{ x: xAt(i), y: yAt(p.value), i }] : []));
  const line = smoothPath(drawn);
  const area = drawn.length > 1 ? `${line} L${drawn.at(-1)!.x},${height} L${drawn[0].x},${height} Z` : '';
  const gradId = `line${label.replace(/\W/g, '')}`;

  const sel = points[index];
  const diff = sel?.value != null ? sel.value - mid : null;
  const good = diff !== null && (higherIsBetter ? diff > 0 : diff < 0);
  const detail =
    diff === null
      ? 'no reading'
      : sel!.value! >= low && sel!.value! <= high
        ? `within your normal range (${format(low)}–${format(high)})`
        : `${format(Math.abs(diff))} ${diff > 0 ? 'above' : 'below'} your typical ${format(mid)} · ${good ? 'good sign' : 'worth watching'}`;

  return (
    <View style={styles.wrap}>
      <ChartHeader
        value={sel?.value != null ? format(sel.value) : '--'}
        color={color}
        title={sel ? dayName(sel.date, index === n - 1) : ''}
        detail={detail}
        right={
          <RangeSwitch
            value={range}
            onChange={(r) => {
              setRange(r);
              reset();
              resetZoom();
            }}
          />
        }
      />
      <OpenDayLink back={n - 1 - index} date={points[index]?.date} zoom={{ zoomed, onReset: resetZoom }} />
      <View {...scrubProps} style={styles.plot} accessible accessibilityLabel={`${label}, last ${n} days. Your normal ${format(low)} to ${format(high)}.`}>
        {width > 0 ? (
          <View pointerEvents="none">
            <Reveal width={width} height={height}>
              <Svg width={width} height={height}>
                <Defs>
                  <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={color} stopOpacity={0.35} />
                    <Stop offset="1" stopColor={color} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={yAt(high)} width={width} height={Math.max(yAt(low) - yAt(high), 1)} fill={colors.text} opacity={0.06} />
                <Line x1={0} x2={width} y1={yAt(mid)} y2={yAt(mid)} stroke={colors.text} strokeOpacity={0.3} strokeDasharray="3 4" />
                {area ? <Path d={area} fill={`url(#${gradId})`} /> : null}
                <Path d={line} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {last - first < 14 ? drawn.map((p) => <Circle key={p.i} cx={p.x} cy={p.y} r={2.5} fill={color} />) : null}
                {sel?.value != null ? (
                  <>
                    <Line x1={xAt(index)} x2={xAt(index)} y1={0} y2={height} stroke={colors.text} strokeOpacity={0.25} />
                    <Circle cx={xAt(index)} cy={yAt(sel.value)} r={7} fill={color} opacity={0.25} />
                    <Circle cx={xAt(index)} cy={yAt(sel.value)} r={4} fill={colors.text} stroke={color} strokeWidth={2} />
                  </>
                ) : null}
              </Svg>
            </Reveal>
          </View>
        ) : (
          <View style={{ height }} />
        )}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{dayName(points[first].date, false)}</Text>
        <Text style={styles.axisText}>{dayName(points[last].date, last === n - 1)}</Text>
      </View>
      <Legend
        items={[
          { label, color },
          { label: 'your normal range', color: withAlpha(colors.muted, 0.45) },
        ]}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  wrap: { gap: 10 },
  plot: { overflow: 'hidden' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  axisText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11 },
}));
