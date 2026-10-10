import { heartRateZone, ZONE_BOUNDS, type HeartRateSample } from '@fitness/scoring';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { fonts, withAlpha, type Palette } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { formatTime } from '@/lib/format';
import { ChartHeader, Legend, Reveal, useScrub } from './parts';

const MINUTE = 60_000;
const FULL_DAY = 24 * 60 * MINUTE;
/** Longer gaps between readings break the line instead of drawing a straight bridge across them. */
const GAP_MS = 15 * MINUTE;
const PAD_Y = 8;

interface Props {
  /** The calendar day's samples, oldest first. */
  samples: HeartRateSample[];
  /** YYYY-MM-DD; the chart always spans that day's midnight to midnight. */
  date: string;
  restingHr: number;
  maxHr: number;
  /** The main sleep, shaded behind the line. */
  sleep?: { start: number; end: number };
  /** Small version for the Today card: no readout, legend or scrubbing. */
  compact?: boolean;
  /** Zoom in on part of the day (e.g. one activity) instead of midnight to midnight. Epoch ms. */
  window?: { start: number; end: number };
  height?: number;
}

/** "Resting", or "Zone 3" for zone index 2. */
export function zoneName(zone: number): string {
  return zone < 0 ? 'Resting / light' : `Zone ${zone + 1}`;
}

export function zoneColor(zone: number, colors: Palette): string {
  return zone < 0 ? colors.muted : colors.hrZones[zone];
}

/** Averages samples into fixed time buckets, so a day of 5-second readings stays light to draw. */
function bucket(samples: HeartRateSample[], size: number): HeartRateSample[] {
  const out: HeartRateSample[] = [];
  let key = -1;
  let sum = 0;
  let count = 0;
  for (const s of samples) {
    const k = Math.floor(s.time / size);
    if (k !== key && count > 0) {
      out.push({ time: key * size + size / 2, bpm: sum / count });
      sum = 0;
      count = 0;
    }
    key = k;
    sum += s.bpm;
    count += 1;
  }
  if (count > 0) out.push({ time: key * size + size / 2, bpm: sum / count });
  return out;
}

/**
 * One day of heart rate, midnight to midnight. The line takes the color of the zone it's in (the
 * same zones the strain score uses), so walks and workouts stand out from resting time. Drag to
 * read any moment.
 */
export function HeartRateChart({ samples, date, restingHr, maxHr, sleep, compact = false, window, height = compact ? 64 : 160 }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const [picked, setPicked] = useState<number | null>(null);
  const dayStart = window?.start ?? new Date(`${date}T00:00:00`).getTime();
  const span = window ? Math.max(window.end - window.start, MINUTE) : FULL_DAY;
  const inView = window ? samples.filter((s) => s.time >= window.start && s.time <= window.end) : samples;
  const points = bucket(inView, compact ? 10 * MINUTE : window ? Math.max(Math.round(span / 120), 15_000) : 2 * MINUTE);
  const { width, scrubProps } = useScrub((f) => setPicked(dayStart + f * span));

  if (points.length === 0) {
    return compact ? <View style={{ height }} /> : <Text style={styles.empty}>No heart rate recorded for this day yet.</Text>;
  }

  const bpms = points.map((p) => p.bpm);
  const min = Math.min(...bpms, restingHr) - 6;
  const max = Math.max(Math.max(...bpms) + 6, restingHr + 40);
  const xAt = (t: number) => ((t - dayStart) / span) * width;
  const yAt = (v: number) => PAD_Y + (1 - (v - min) / (max - min)) * (height - PAD_Y * 2);

  let line = '';
  points.forEach((p, i) => {
    const join = i > 0 && p.time - points[i - 1].time <= GAP_MS;
    line += `${join ? 'L' : 'M'}${xAt(p.time).toFixed(1)},${yAt(p.bpm).toFixed(1)} `;
  });

  // Color bands by height: a hard color change at each zone's lower bound.
  const reserve = maxHr - restingHr;
  const stops: { offset: number; color: string }[] = [];
  const bandColors = [colors.muted, ...colors.hrZones];
  for (let z = ZONE_BOUNDS.length - 1; z >= 0; z--) {
    const offset = Math.min(Math.max(yAt(restingHr + ZONE_BOUNDS[z] * reserve) / height, 0), 1);
    stops.push({ offset, color: bandColors[z + 1] }, { offset, color: bandColors[z] });
  }
  const gradId = `hr${date.replace(/\W/g, '')}${compact ? 'c' : ''}`;

  const sel = picked !== null ? nearest(points, picked) : null;
  const latest = samples.at(-1)!;
  const shown = sel ?? latest;
  const shownZone = heartRateZone(shown.bpm, restingHr, maxHr);
  const sleepBox = sleep && sleep.end > dayStart && sleep.start < dayStart + span ? { x1: xAt(Math.max(sleep.start, dayStart)), x2: xAt(Math.min(sleep.end, dayStart + span)) } : null;

  const plot = (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
          {stops.map((s, i) => (
            <Stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </LinearGradient>
      </Defs>
      {sleepBox ? <Rect x={sleepBox.x1} y={0} width={Math.max(sleepBox.x2 - sleepBox.x1, 1)} height={height} fill={withAlpha(colors.sleep, 0.12)} /> : null}
      {compact
        ? null
        : [6, 12, 18].map((h) => <Line key={h} x1={(width * h) / 24} x2={(width * h) / 24} y1={0} y2={height} stroke={colors.text} strokeOpacity={0.06} />)}
      <Line x1={0} x2={width} y1={yAt(restingHr)} y2={yAt(restingHr)} stroke={colors.text} strokeOpacity={0.3} strokeDasharray="3 4" />
      <Path d={line} stroke={`url(#${gradId})`} strokeWidth={compact ? 1.5 : 2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {sel ? (
        <>
          <Line x1={xAt(sel.time)} x2={xAt(sel.time)} y1={0} y2={height} stroke={colors.text} strokeOpacity={0.25} />
          <Circle cx={xAt(sel.time)} cy={yAt(sel.bpm)} r={4} fill={colors.text} stroke={zoneColor(shownZone, colors)} strokeWidth={2} />
        </>
      ) : (
        <Circle cx={xAt(points.at(-1)!.time)} cy={yAt(points.at(-1)!.bpm)} r={3.5} fill={zoneColor(heartRateZone(points.at(-1)!.bpm, restingHr, maxHr), colors)} />
      )}
    </Svg>
  );

  if (compact) {
    return (
      <View {...scrubProps} pointerEvents="none" style={{ height }}>
        {width > 0 ? plot : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <ChartHeader
        value={`${Math.round(shown.bpm)}`}
        color={zoneColor(shownZone, colors)}
        title={sel ? `${formatTime(sel.time)} · bpm` : `Latest · ${formatTime(latest.time)} · bpm`}
        detail={zoneName(shownZone)}
      />
      <View
        {...scrubProps}
        onTouchEnd={() => setPicked(null)}
        accessible
        accessibilityLabel={`Heart rate through the day, ${Math.round(Math.min(...bpms))} to ${Math.round(Math.max(...bpms))} bpm. Latest ${Math.round(latest.bpm)} at ${formatTime(latest.time)}.`}>
        {width > 0 ? (
          <View pointerEvents="none">
            <Reveal width={width} height={height}>
              {plot}
            </Reveal>
          </View>
        ) : (
          <View style={{ height }} />
        )}
      </View>
      <View style={styles.axis}>
        {(window ? [0, 0.5, 1].map((f) => formatTime(dayStart + f * span)) : ['12 AM', '6 AM', '12 PM', '6 PM', '12 AM']).map((label, i) => (
          <Text key={i} style={styles.axisText}>
            {label}
          </Text>
        ))}
      </View>
      <Legend
        items={[
          { label: `resting ${restingHr}`, color: withAlpha(colors.muted, 0.6), dashed: true },
          ...(sleepBox ? [{ label: 'asleep', color: withAlpha(colors.sleep, 0.5) }] : []),
          { label: 'zones 1–5', color: colors.hrZones[3] },
        ]}
      />
    </View>
  );
}

function nearest(points: HeartRateSample[], time: number): HeartRateSample | null {
  let best: HeartRateSample | null = null;
  for (const p of points) if (!best || Math.abs(p.time - time) < Math.abs(best.time - time)) best = p;
  return best && Math.abs(best.time - time) <= GAP_MS ? best : null;
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  wrap: { gap: 10 },
  empty: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 14, paddingVertical: 24, textAlign: 'center' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  axisText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11 },
}));
