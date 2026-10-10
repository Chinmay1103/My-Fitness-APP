import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { fonts, gradientFor } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { shortDay } from '@/lib/format';
import { ChartHeader, DEFAULT_RANGES, Legend, RangeSwitch, Reveal, dayName, smoothPath, usePickedDay, useScrub } from './parts';

export interface ComboPoint {
  date: string;
  bar: number | null;
  line: number | null;
  /** Per-day dot color on the line, e.g. the recovery zone. */
  lineColor?: string;
}

interface Props {
  /** Oldest first, ending today; pass at least 30 days. */
  points: ComboPoint[];
  bar: { label: string; color: string; max: number; format: (v: number) => string };
  line: { label: string; color: string; max: number; format: (v: number) => string; dashed?: boolean };
  /** Second line of the readout for the picked day; defaults to "<line label> <value>". */
  describe?: (p: ComboPoint) => string;
  height?: number;
}

const GAP = 3;
const TOP = 8;

/**
 * Bars and a line on the same days, for two things that move together: strain (bars) against
 * recovery (line), or hours slept (bars) against hours needed (dashed line). Drag to scrub.
 */
export function ComboChart({ points: all, bar, line, describe, height = 130 }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const [range, setRange] = useState<number>(DEFAULT_RANGES[1]);
  const points = all.slice(-range);
  const n = points.length;
  const { index, pick, reset } = usePickedDay(n, (i) => points[i]?.bar != null || points[i]?.line != null);
  const { width, scrubProps } = useScrub((f) => pick(Math.floor(f * n)));

  const slot = width / n;
  const plotH = height - TOP;
  const barY = (v: number) => TOP + (1 - Math.min(v / bar.max, 1)) * plotH;
  const lineY = (v: number) => TOP + (1 - Math.min(v / line.max, 1)) * plotH;
  const drawn = points.flatMap((p, i) => (p.line != null ? [{ x: i * slot + slot / 2, y: lineY(p.line), i }] : []));
  const [light, dark] = gradientFor(bar.color, colors);
  const gradId = `combo${bar.label.replace(/\W/g, '')}`;
  const labelEvery = n > 14 ? 7 : 1;

  const sel = points[index];
  const detail = sel ? (describe ? describe(sel) : `${line.label} ${sel.line != null ? line.format(sel.line) : '--'}`) : '';

  return (
    <View style={styles.wrap}>
      <ChartHeader
        value={sel?.bar != null ? bar.format(sel.bar) : '--'}
        color={light}
        title={sel ? dayName(sel.date, index === n - 1) : ''}
        detail={detail}
        right={
          <RangeSwitch
            value={range}
            onChange={(r) => {
              setRange(r);
              reset();
            }}
          />
        }
      />
      <View {...scrubProps} accessible accessibilityLabel={`${bar.label} and ${line.label}, last ${n} days.`}>
        {width > 0 ? (
          <View pointerEvents="none">
            <Reveal width={width} height={height}>
              <Svg width={width} height={height}>
                <Defs>
                  <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={light} />
                    <Stop offset="1" stopColor={dark} />
                  </LinearGradient>
                </Defs>
                {sel ? <Rect x={index * slot} y={0} width={slot} height={height} rx={4} fill={colors.track} /> : null}
                {points.map((p, i) =>
                  p.bar != null ? (
                    <Rect
                      key={p.date}
                      x={i * slot + GAP / 2}
                      y={barY(p.bar)}
                      width={Math.max(slot - GAP, 1)}
                      height={Math.max(height - barY(p.bar), 2)}
                      rx={Math.min(4, (slot - GAP) / 2)}
                      fill={`url(#${gradId})`}
                      opacity={i === index ? 1 : 0.5}
                    />
                  ) : null,
                )}
                <Path
                  d={smoothPath(drawn)}
                  stroke={line.color}
                  strokeWidth={2}
                  strokeOpacity={0.9}
                  strokeDasharray={line.dashed ? '5 5' : undefined}
                  fill="none"
                  strokeLinecap="round"
                />
                {drawn.map((p) => (
                  <Circle
                    key={p.i}
                    cx={p.x}
                    cy={p.y}
                    r={p.i === index ? 5 : n > 14 ? 2 : 3}
                    fill={points[p.i].lineColor ?? line.color}
                    stroke={p.i === index ? colors.text : undefined}
                    strokeWidth={p.i === index ? 2 : 0}
                  />
                ))}
                {sel ? <Line x1={index * slot + slot / 2} x2={index * slot + slot / 2} y1={0} y2={TOP} stroke={colors.text} strokeOpacity={0.4} /> : null}
              </Svg>
            </Reveal>
          </View>
        ) : (
          <View style={{ height }} />
        )}
        <View style={styles.days} pointerEvents="none">
          {points.map((p, i) => (
            <View key={p.date} style={styles.dayCell}>
              {i === index || (n - 1 - i) % labelEvery === 0 ? (
                <Text style={[styles.day, i === index && styles.daySelected]} numberOfLines={1}>
                  {shortDay(p.date)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>
      <Legend
        items={[
          { label: bar.label, color: bar.color },
          { label: line.label, color: line.color, dashed: line.dashed },
        ]}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  wrap: { gap: 10 },
  days: { flexDirection: 'row', marginTop: 6 },
  dayCell: { flex: 1, alignItems: 'center' },
  day: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11, marginHorizontal: -12, textAlign: 'center' },
  daySelected: { color: colors.text, fontFamily: fonts.bodySemi },
}));
