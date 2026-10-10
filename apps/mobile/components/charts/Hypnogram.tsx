import type { SleepSegment, SleepStage } from '@fitness/scoring';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { fonts, withAlpha } from '@/constants/theme';
import { formatMinutes, formatTime } from '@/lib/format';
import { tapHaptic } from '@/lib/haptics';
import { makeStyles, useColors } from '@/lib/theme';
import { ChartHeader, Reveal, useScrub } from './parts';

/** Top to bottom, lightest to deepest, like every sleep app draws it. */
const ROWS: { stage: SleepStage; label: string; about: string }[] = [
  { stage: 'awake', label: 'Awake', about: 'Short wake-ups are normal; most you never remember' },
  { stage: 'rem', label: 'REM', about: 'Dreaming sleep: memory, learning and mood' },
  { stage: 'light', label: 'Light', about: 'Most of the night; still restful, links the other stages' },
  { stage: 'deep', label: 'Deep', about: 'Body repair: muscles, immune system, growth hormone' },
];
const LABEL_W = 62;
const ROW_H = 38;
const AXIS_H = 22;
const HOUR = 3_600_000;
const MIN = 60_000;
/** Each stage sits as a band this tall inside its row; the line runs through its middle. */
const BAND_H = 14;

/**
 * The night stage by stage, drawn the way sleep labs do: one continuous stepped line that drops
 * into deeper rows and climbs back out, over a soft fill colored by depth. Short stretches stay
 * thin steps instead of floating blobs, so a fragmented night of real band data still reads as one
 * night. Drag across it to read each stretch; tap a stage name to light up all of that stage.
 */
export function Hypnogram({ segments }: { segments: SleepSegment[] }) {
  const colors = useColors();
  const styles = useStyles();
  const start = segments[0].start;
  const end = segments.at(-1)!.end;
  const span = Math.max(end - start, 1);
  const [picked, setPicked] = useState<number | null>(null);
  const [focusStage, setFocusStage] = useState<SleepStage | null>(null);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;

  // The drag area covers only the plot (right of the stage names), so its width is the plot's.
  const { width: plotW, scrubProps } = useScrub((f) => {
    const t = start + f * span;
    const i = segments.findIndex((s) => t >= s.start && t < s.end);
    if (i >= 0 && i !== pickedRef.current) {
      tapHaptic();
      setPicked(i);
      setFocusStage(null);
    }
  });

  const width = plotW + LABEL_W;
  const plotH = ROWS.length * ROW_H;
  const x = (t: number) => LABEL_W + ((t - start) / span) * plotW;
  const rowOf = (stage: SleepStage) => ROWS.findIndex((r) => r.stage === stage);
  const midY = (stage: SleepStage) => rowOf(stage) * ROW_H + ROW_H / 2;
  const stageColor = (stage: SleepStage) => (stage === 'awake' ? colors.sleepStages.awake : colors.sleepStages[stage]);
  const labelColor = (stage: SleepStage) => (stage === 'awake' ? colors.text : colors.scheme === 'light' ? colors.sleepStages[stage] : colors.sleepStageLight[stage]);

  const firstHour = Math.ceil(start / HOUR) * HOUR;
  const hours: number[] = [];
  for (let t = firstHour; t < end; t += HOUR) hours.push(t);

  const stats = nightStats(segments);
  const seg = picked !== null ? segments[picked] : null;
  const row = seg ? ROWS[rowOf(seg.stage)] : null;
  const focusRow = focusStage ? ROWS[rowOf(focusStage)] : null;
  const line = stepPath(segments, x, midY);
  // Close the line down to the bottom edge for the fill under it.
  const area = `${line} L${x(end)},${plotH} L${x(start)},${plotH} Z`;
  // Stop positions for the depth gradient: each row's middle, as a fraction of the plot height.
  const stops = ROWS.map((r, i) => ({ offset: (i * ROW_H + ROW_H / 2) / plotH, color: stageColor(r.stage) }));

  const pickStage = (stage: SleepStage) => {
    tapHaptic();
    setPicked(null);
    setFocusStage((s) => (s === stage ? null : stage));
  };

  return (
    <View style={styles.wrap}>
      {seg && row ? (
        <ChartHeader
          value={formatMinutes((seg.end - seg.start) / MIN)}
          color={labelColor(seg.stage)}
          title={`${row.label} · ${formatTime(seg.start)} – ${formatTime(seg.end)}`}
          detail={row.about}
        />
      ) : focusRow && focusStage ? (
        <ChartHeader
          value={formatMinutes(stats.totals[focusStage])}
          color={labelColor(focusStage)}
          title={`${focusRow.label} · ${Math.round((stats.totals[focusStage] / Math.max(stats.asleep + stats.totals.awake, 1)) * 100)}% of the night, ${stats.counts[focusStage]} stretch${stats.counts[focusStage] === 1 ? '' : 'es'}`}
          detail={focusRow.about}
        />
      ) : (
        <ChartHeader
          value={formatMinutes(stats.asleep)}
          color={labelColor('rem')}
          title={`Asleep · ${stats.cycles} sleep cycle${stats.cycles === 1 ? '' : 's'}`}
          detail="Drag across the night, or tap a stage"
        />
      )}

      <View style={{ height: plotH + AXIS_H }}>
        {/* Stage names: tappable, outside the drag area. */}
        <View style={[styles.labels, { height: plotH }]}>
          {ROWS.map((r) => (
            <Pressable
              key={r.stage}
              onPress={() => pickStage(r.stage)}
              accessibilityRole="button"
              accessibilityLabel={`${r.label}: ${formatMinutes(stats.totals[r.stage])}`}
              style={[styles.rowLabel, focusStage === r.stage && styles.rowLabelOn]}>
              <Text style={[styles.rowName, { color: labelColor(r.stage) }]}>{r.label}</Text>
              <Text style={styles.rowTotal}>{formatMinutes(stats.totals[r.stage])}</Text>
            </Pressable>
          ))}
        </View>

        <View
          {...scrubProps}
          style={[StyleSheet.absoluteFill, { left: LABEL_W }]}
          accessible
          accessibilityLabel={`Sleep stages from ${formatTime(start)} to ${formatTime(end)}: ${stats.cycles} cycles, ${stats.wakeups} wake-ups.`}
        />

        {plotW > 0 ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Reveal width={width} height={plotH}>
              <Svg width={width} height={plotH}>
                <Defs>
                  <LinearGradient id="hyp-line" x1="0" y1="0" x2="0" y2={plotH} gradientUnits="userSpaceOnUse">
                    {stops.map((s) => (
                      <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
                    ))}
                  </LinearGradient>
                  <LinearGradient id="hyp-fill" x1="0" y1="0" x2="0" y2={plotH} gradientUnits="userSpaceOnUse">
                    {[
                      ...stops.map((s) => (
                        <Stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={colors.scheme === 'light' ? 0.16 : 0.2} />
                      )),
                      <Stop key="end" offset={1} stopColor={colors.sleepStages.deep} stopOpacity={0.04} />,
                    ]}
                  </LinearGradient>
                </Defs>
                {/* A faint lane per stage, and hour lines. */}
                {ROWS.map((r, i) => (
                  <Rect
                    key={r.stage}
                    x={LABEL_W}
                    y={i * ROW_H + (ROW_H - BAND_H) / 2 - 4}
                    width={plotW}
                    height={BAND_H + 8}
                    rx={6}
                    fill={focusStage === r.stage ? withAlpha(stageColor(r.stage), 0.16) : colors.track}
                    opacity={focusStage === r.stage ? 1 : 0.45}
                  />
                ))}
                {hours.map((t) => (
                  <Line key={t} x1={x(t)} x2={x(t)} y1={0} y2={plotH} stroke={colors.muted} strokeOpacity={0.18} strokeDasharray="2 4" />
                ))}

                <Path d={area} fill="url(#hyp-fill)" />
                {/* Every stretch as a flat band in its row: thin steps for short ones, never dots. */}
                {segments.map((s, i) => {
                  const dim = (focusStage && s.stage !== focusStage) || (picked !== null && picked !== i);
                  return (
                    <Rect
                      key={s.start}
                      x={x(s.start)}
                      y={midY(s.stage) - BAND_H / 2}
                      width={Math.max(x(s.end) - x(s.start), 1.5)}
                      height={BAND_H}
                      rx={Math.min(3, (x(s.end) - x(s.start)) / 2)}
                      fill={stageColor(s.stage)}
                      opacity={dim ? 0.25 : 0.95}
                    />
                  );
                })}
                <Path d={line} stroke="url(#hyp-line)" strokeWidth={1.5} fill="none" strokeLinejoin="round" opacity={focusStage || seg ? 0.35 : 0.8} />

                {seg ? (
                  <>
                    <Rect x={x(seg.start)} y={0} width={Math.max(x(seg.end) - x(seg.start), 2)} height={plotH} fill={colors.text} opacity={0.07} />
                    <Line x1={x(seg.start)} x2={x(seg.start)} y1={0} y2={plotH} stroke={colors.text} strokeOpacity={0.4} />
                    <Line x1={x(seg.end)} x2={x(seg.end)} y1={0} y2={plotH} stroke={colors.text} strokeOpacity={0.4} />
                  </>
                ) : null}
              </Svg>
            </Reveal>
            <View style={[styles.axis, { marginLeft: LABEL_W }]}>
              <View style={styles.axisEnd}>
                <SymbolView name={{ ios: 'moon.stars.fill', android: 'nights_stay', web: 'nights_stay' }} tintColor={colors.muted} size={13} />
                <Text style={styles.axisText}>{formatTime(start)}</Text>
              </View>
              {hours.length >= 4 ? <Text style={styles.axisText}>{formatTime(hours[Math.floor(hours.length / 2)])}</Text> : null}
              <View style={styles.axisEnd}>
                <Text style={styles.axisText}>{formatTime(end)}</Text>
                <SymbolView name={{ ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' }} tintColor={colors.muted} size={13} />
              </View>
            </View>
          </View>
        ) : null}
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
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** The night as one stepped line: flat through each stretch, straight up or down between stages. */
function stepPath(segments: SleepSegment[], x: (t: number) => number, midY: (s: SleepStage) => number): string {
  let d = `M${x(segments[0].start)},${midY(segments[0].stage)}`;
  for (const s of segments) {
    d += ` V${midY(s.stage)} H${x(s.end)}`;
  }
  return d;
}

/** The night in numbers for the summary row. Only for display; scores use the stage totals. */
export function nightStats(segments: SleepSegment[]) {
  const totals: Record<SleepStage, number> = { awake: 0, light: 0, deep: 0, rem: 0 };
  const counts: Record<SleepStage, number> = { awake: 0, light: 0, deep: 0, rem: 0 };
  let longestDeep = 0;
  let wakeups = 0;
  let cycles = 0;
  let lastRemEnd = -Infinity;
  segments.forEach((s, i) => {
    const minutes = (s.end - s.start) / MIN;
    totals[s.stage] += minutes;
    counts[s.stage] += 1;
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
  return { totals, counts, asleep: totals.light + totals.deep + totals.rem, longestDeep, wakeups, cycles, latency };
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  wrap: { gap: 14 },
  labels: { position: 'absolute', left: 0, top: 0, width: LABEL_W - 6 },
  rowLabel: { height: ROW_H, justifyContent: 'center', borderRadius: 8, paddingLeft: 2 },
  rowLabelOn: { backgroundColor: colors.track },
  rowName: { fontFamily: fonts.bodySemi, fontSize: 12 },
  rowTotal: { color: colors.muted, fontFamily: fonts.numberSemi, fontSize: 12, fontVariant: ['tabular-nums'] },
  axis: { height: AXIS_H, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  axisEnd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  axisText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 },
  stat: { alignItems: 'center', flex: 1, gap: 2 },
  statValue: { color: colors.text, fontFamily: fonts.number, fontSize: 18, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 10, textAlign: 'center' },
}));
