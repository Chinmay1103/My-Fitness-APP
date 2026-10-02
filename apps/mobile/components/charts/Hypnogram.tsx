import type { SleepSegment, SleepStage } from '@fitness/scoring';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors, fonts } from '@/constants/theme';
import { formatMinutes, formatTime } from '@/lib/format';
import { tapHaptic } from '@/lib/haptics';
import { ChartHeader, Reveal, useScrub } from './parts';

/** Top to bottom, lightest to deepest, like every sleep app draws it. */
const ROWS: { stage: SleepStage; label: string; about: string }[] = [
  { stage: 'awake', label: 'Awake', about: 'Short wake-ups are normal; most you never remember' },
  { stage: 'rem', label: 'REM', about: 'Dreaming sleep: memory, learning and mood' },
  { stage: 'light', label: 'Light', about: 'Most of the night; still restful, links the other stages' },
  { stage: 'deep', label: 'Deep', about: 'Body repair: muscles, immune system, growth hormone' },
];
const LABEL_W = 58;
const ROW_H = 36;
const BLOCK_H = 20;
const AXIS_H = 22;
const HOUR = 3_600_000;
const MIN = 60_000;

/** Lighter top of each stage's block gradient. */
const LIGHT: Record<SleepStage, string> = {
  awake: '#FFFFFF',
  rem: '#E4D8FF',
  light: '#B39DFF',
  deep: '#8466F0',
};

/**
 * The night stage by stage: one row per stage (with its total), a softly shaded block for each
 * stretch, joined by a flowing line, bedtime and wake-up at the ends and a short summary below.
 * Drag across it to see what you were in at each moment and what that stage does.
 */
export function Hypnogram({ segments }: { segments: SleepSegment[] }) {
  const start = segments[0].start;
  const end = segments.at(-1)!.end;
  const span = end - start;
  const [picked, setPicked] = useState<number | null>(null);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;

  const { width, scrubProps } = useScrub((f) => {
    const t = start + f * span;
    const i = segments.findIndex((s) => t >= s.start && t < s.end);
    if (i >= 0 && i !== pickedRef.current) {
      tapHaptic();
      setPicked(i);
    }
  });

  const plotW = Math.max(width - LABEL_W, 0);
  const plotH = ROWS.length * ROW_H;
  const x = (t: number) => LABEL_W + ((t - start) / span) * plotW;
  const rowOf = (stage: SleepStage) => ROWS.findIndex((r) => r.stage === stage);
  const midY = (stage: SleepStage) => rowOf(stage) * ROW_H + ROW_H / 2;

  const firstHour = Math.ceil(start / HOUR) * HOUR;
  const hours: number[] = [];
  for (let t = firstHour; t < end; t += HOUR) hours.push(t);

  const stats = nightStats(segments);
  const seg = picked !== null ? segments[picked] : null;
  const row = seg ? ROWS[rowOf(seg.stage)] : null;

  return (
    <View style={styles.wrap}>
      {seg && row ? (
        <ChartHeader
          value={formatMinutes((seg.end - seg.start) / MIN)}
          color={LIGHT[seg.stage] === '#FFFFFF' ? colors.text : LIGHT[seg.stage]}
          title={`${row.label} · ${formatTime(seg.start)} – ${formatTime(seg.end)}`}
          detail={row.about}
        />
      ) : (
        <ChartHeader
          value={formatMinutes(stats.asleep)}
          color={LIGHT.rem}
          title={`Asleep · ${stats.cycles} sleep cycles`}
          detail="Drag across the night to see each stage"
        />
      )}

      <View
        {...scrubProps}
        accessible
        accessibilityLabel={`Sleep stages from ${formatTime(start)} to ${formatTime(end)}: ${stats.cycles} cycles, ${stats.wakeups} wake-ups.`}>
        {width > 0 ? (
          <View pointerEvents="none">
            <View style={StyleSheet.absoluteFill}>
              {ROWS.map((r, i) => (
                <View key={r.stage} style={[styles.rowLabel, { top: i * ROW_H }]}>
                  <Text style={[styles.rowName, { color: r.stage === 'awake' ? colors.text : LIGHT[r.stage] }]}>{r.label}</Text>
                  <Text style={styles.rowTotal}>{formatMinutes(stats.totals[r.stage])}</Text>
                </View>
              ))}
            </View>
            <Reveal width={width} height={plotH}>
              <Svg width={width} height={plotH}>
                <Defs>
                  {ROWS.map((r) => (
                    <LinearGradient key={r.stage} id={`hyp-${r.stage}`} x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={LIGHT[r.stage]} />
                      <Stop offset="1" stopColor={colors.sleepStages[r.stage]} />
                    </LinearGradient>
                  ))}
                </Defs>
                {/* A faint lane per stage. */}
                {ROWS.map((r, i) => (
                  <Rect key={r.stage} x={LABEL_W} y={i * ROW_H + 3} width={plotW} height={ROW_H - 6} rx={8} fill={colors.text} opacity={i % 2 ? 0.025 : 0.045} />
                ))}
                {hours.map((t) => (
                  <Line key={t} x1={x(t)} x2={x(t)} y1={0} y2={plotH} stroke={colors.text} strokeOpacity={0.07} strokeDasharray="2 4" />
                ))}
                {/* The flow from stage to stage, under the blocks. */}
                <Path d={flowPath(segments, x, midY)} stroke={colors.text} strokeOpacity={0.3} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
                {seg ? (
                  <Rect
                    x={x(seg.start) - 3}
                    y={midY(seg.stage) - BLOCK_H / 2 - 4}
                    width={Math.max(x(seg.end) - x(seg.start), 3) + 6}
                    height={BLOCK_H + 8}
                    rx={9}
                    fill={LIGHT[seg.stage]}
                    opacity={0.22}
                  />
                ) : null}
                {segments.map((s, i) => (
                  <Rect
                    key={s.start}
                    x={x(s.start)}
                    y={midY(s.stage) - BLOCK_H / 2}
                    width={Math.max(x(s.end) - x(s.start), 3)}
                    height={BLOCK_H}
                    rx={6}
                    fill={`url(#hyp-${s.stage})`}
                    opacity={picked === null || picked === i ? 1 : 0.35}
                  />
                ))}
                {seg ? (
                  <>
                    <Line x1={x((seg.start + seg.end) / 2)} x2={x((seg.start + seg.end) / 2)} y1={0} y2={plotH} stroke={colors.text} strokeOpacity={0.5} />
                    <Circle cx={x((seg.start + seg.end) / 2)} cy={midY(seg.stage)} r={4} fill={colors.text} />
                  </>
                ) : null}
              </Svg>
            </Reveal>
            <View style={[styles.axis, { marginLeft: LABEL_W }]}>
              <View style={styles.axisEnd}>
                <SymbolView name={{ ios: 'moon.fill', android: 'bedtime', web: 'bedtime' }} tintColor={colors.muted} size={13} />
                <Text style={styles.axisText}>{formatTime(start)}</Text>
              </View>
              <View style={styles.axisEnd}>
                <Text style={styles.axisText}>{formatTime(end)}</Text>
                <SymbolView name={{ ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' }} tintColor={colors.muted} size={13} />
              </View>
            </View>
          </View>
        ) : (
          <View style={{ height: plotH + AXIS_H }} />
        )}
      </View>

      <View style={styles.stats}>
        <MiniStat label="Fell asleep in" value={formatMinutes(stats.latency)} />
        <MiniStat label="Sleep cycles" value={String(stats.cycles)} />
        <MiniStat label="Wake-ups" value={String(stats.wakeups)} />
        <MiniStat label="Longest deep" value={formatMinutes(stats.longestDeep)} />
      </View>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * A line through the middle of each block that bends smoothly into the next stage's row, so the
 * night reads as one flowing path rather than separate boxes.
 */
function flowPath(segments: SleepSegment[], x: (t: number) => number, midY: (s: SleepStage) => number): string {
  let d = `M${x(segments[0].start)},${midY(segments[0].stage)}`;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const next = segments[i + 1];
    const xEnd = x(s.end);
    if (!next) {
      d += ` L${xEnd},${midY(s.stage)}`;
      break;
    }
    const r = Math.min(4, (xEnd - x(s.start)) / 2, (x(next.end) - xEnd) / 2);
    d += ` L${xEnd - r},${midY(s.stage)} C${xEnd},${midY(s.stage)} ${xEnd},${midY(next.stage)} ${xEnd + r},${midY(next.stage)}`;
  }
  return d;
}

/** The night in numbers for the summary row. Only for display; scores use the stage totals. */
function nightStats(segments: SleepSegment[]) {
  const totals: Record<SleepStage, number> = { awake: 0, light: 0, deep: 0, rem: 0 };
  let longestDeep = 0;
  let wakeups = 0;
  let cycles = 0;
  let lastRemEnd = -Infinity;
  segments.forEach((s, i) => {
    const minutes = (s.end - s.start) / MIN;
    totals[s.stage] += minutes;
    if (s.stage === 'deep') longestDeep = Math.max(longestDeep, minutes);
    // Waking in the middle of the night; lying awake before sleep or after the last stage isn't one.
    if (s.stage === 'awake' && i > 0 && i < segments.length - 1 && minutes >= 1) wakeups++;
    // A cycle ends with REM; REM split by a short gap (under 30 min) is still the same cycle.
    if (s.stage === 'rem') {
      if (s.start - lastRemEnd > 30 * MIN) cycles++;
      lastRemEnd = s.end;
    }
  });
  const latency = segments[0].stage === 'awake' ? (segments[0].end - segments[0].start) / MIN : 0;
  return { totals, asleep: totals.light + totals.deep + totals.rem, longestDeep, wakeups, cycles, latency };
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  rowLabel: { position: 'absolute', left: 0, height: ROW_H, justifyContent: 'center' },
  rowName: { fontFamily: fonts.bodySemi, fontSize: 12 },
  rowTotal: { color: colors.muted, fontFamily: fonts.numberSemi, fontSize: 12, fontVariant: ['tabular-nums'] },
  axis: { height: AXIS_H, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  axisEnd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  axisText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 },
  stat: { alignItems: 'center', flex: 1, gap: 2 },
  statValue: { color: colors.text, fontFamily: fonts.number, fontSize: 18, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 10, textAlign: 'center' },
});
