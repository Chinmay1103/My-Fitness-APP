import { ZONE_BOUNDS, type HeartRateSample } from '@fitness/scoring';
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { colors, fonts } from '@/constants/theme';
import { RangeSwitch, smoothPath } from './parts';

const WINDOWS = [5, 15, 30] as const;
const PAD_Y = 8;
/** One point per this many pixels, each the average of the readings in it. */
const PX_PER_POINT = 3;

interface Props {
  /** Readings, oldest first; usually one a second. */
  samples: HeartRateSample[];
  restingHr: number;
  maxHr: number;
  height?: number;
}

/**
 * The last few minutes of live heart rate, over faint bands for the five heart-rate zones, so you
 * can see which zone you're in and how fast you come down after an effort. Redraws with every
 * reading, so no reveal animation.
 */
export function LiveHeartChart({ samples, restingHr, maxHr, height = 170 }: Props) {
  const [minutes, setMinutes] = useState<number>(WINDOWS[1]);
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const end = samples.at(-1)?.time ?? Date.now();
  const start = end - minutes * 60_000;
  const shown = samples.filter((s) => s.time >= start);
  const reserve = Math.max(maxHr - restingHr, 1);
  const zoneBpm = ZONE_BOUNDS.map((b) => restingHr + b * reserve);

  const values = shown.map((s) => s.bpm);
  const low = values.length ? Math.min(...values) : restingHr;
  const high = values.length ? Math.max(...values) : zoneBpm[0];
  const spread = Math.max(high - low, 30);
  const min = Math.floor((low + high) / 2 - spread / 2 - 6);
  const max = Math.ceil((low + high) / 2 + spread / 2 + 6);
  const yAt = (bpm: number) => PAD_Y + (1 - (bpm - min) / (max - min)) * (height - PAD_Y * 2);
  const xAt = (time: number) => ((time - start) / (end - start || 1)) * width;

  // Average into pixel-wide slots; a slot with no reading breaks the line.
  const slots = Math.max(Math.floor(width / PX_PER_POINT), 1);
  const sums = new Array<number>(slots).fill(0);
  const counts = new Array<number>(slots).fill(0);
  for (const s of shown) {
    const i = Math.min(Math.floor(((s.time - start) / (end - start || 1)) * slots), slots - 1);
    sums[i] += s.bpm;
    counts[i] += 1;
  }
  const runs: { x: number; y: number }[][] = [];
  for (let i = 0; i < slots; i++) {
    if (!counts[i]) continue;
    const point = { x: ((i + 0.5) / slots) * width, y: yAt(sums[i] / counts[i]) };
    if (i > 0 && counts[i - 1]) runs.at(-1)!.push(point);
    else runs.push([point]);
  }
  const line = runs.map(smoothPath).join(' ');
  const area = runs
    .filter((r) => r.length > 1)
    .map((r) => `${smoothPath(r)} L${r.at(-1)!.x},${height} L${r[0].x},${height} Z`)
    .join(' ');

  const latest = samples.at(-1);
  const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.summary}>
          {avg != null ? `avg ${avg} · low ${low} · high ${high} bpm` : 'Waiting for readings…'}
        </Text>
        <RangeSwitch ranges={WINDOWS} value={minutes} onChange={setMinutes} unit="m" />
      </View>
      <View
        onLayout={onLayout}
        accessible
        accessibilityLabel={avg != null ? `Heart rate, last ${minutes} minutes: average ${avg}, low ${low}, high ${high} beats per minute` : 'No heart rate readings yet'}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="liveFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.restingHr} stopOpacity={0.3} />
                <Stop offset="1" stopColor={colors.restingHr} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {zoneBpm.map((bottom, i) => {
              const top = Math.min(zoneBpm[i + 1] ?? max, max);
              if (top <= min || bottom >= max) return null;
              const y1 = yAt(top);
              const y2 = yAt(Math.max(bottom, min));
              return (
                <Rect key={i} x={0} y={y1} width={width} height={Math.max(y2 - y1, 0)} fill={colors.hrZones[i]} opacity={0.09} />
              );
            })}
            {zoneBpm.map((bpm, i) =>
              bpm > min && bpm < max ? (
                <Line key={i} x1={0} x2={width} y1={yAt(bpm)} y2={yAt(bpm)} stroke={colors.hrZones[i]} strokeOpacity={0.35} strokeDasharray="2 5" />
              ) : null,
            )}
            {zoneBpm.map((bpm, i) => {
              const top = Math.min(zoneBpm[i + 1] ?? max, max);
              if (bpm >= max || top <= min || yAt(Math.max(bpm, min)) - yAt(top) < 14) return null;
              return (
                <SvgText key={i} x={width - 4} y={yAt(Math.max(bpm, min)) - 4} fill={colors.hrZones[i]} fontSize={10} fontFamily={fonts.label} textAnchor="end">
                  {`Z${i + 1}`}
                </SvgText>
              );
            })}
            {area ? <Path d={area} fill="url(#liveFill)" /> : null}
            <Path d={line} stroke={colors.restingHr} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {latest && latest.time >= start ? (
              <>
                <Circle cx={Math.min(xAt(latest.time), width - 4)} cy={yAt(latest.bpm)} r={7} fill={colors.restingHr} opacity={0.25} />
                <Circle cx={Math.min(xAt(latest.time), width - 4)} cy={yAt(latest.bpm)} r={4} fill={colors.text} stroke={colors.restingHr} strokeWidth={2} />
              </>
            ) : null}
          </Svg>
        ) : (
          <View style={{ height }} />
        )}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{`${minutes} min ago`}</Text>
        <Text style={styles.axisText}>Now</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  summary: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12, flexShrink: 1 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  axisText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11 },
});
