import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sparkline } from '@/components/charts/Sparkline';
import { fonts, radius, spacing, withAlpha } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { metricStatus, type MetricDef, type MetricStatus } from '@/lib/metrics';
import { makeStyles, useColors } from '@/lib/theme';

/**
 * One metric on the Today dashboard: icon and name, the picked day's value, a status chip
 * (vs your normal or the goal) and the last week as a sparkline. Tap for the metric's own screen.
 */
export function MetricTile({ def, series, index }: { def: MetricDef; series: (number | null)[]; index: number }) {
  const colors = useColors();
  const styles = useStyles();
  const [w, setW] = useState(0);
  const value = series[index];
  const color = def.color(colors);
  const status = metricStatus(def, series, index);
  const week = series.slice(Math.max(0, index - 6), index + 1);

  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        router.push({ pathname: '/metric/[key]', params: { key: def.key } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${def.label}: ${value != null ? `${def.format(value)} ${def.unit}` : 'no data'}${status ? `, ${status.label}` : ''}. Open details.`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.head}>
        <View style={[styles.iconWrap, { backgroundColor: withAlpha(color, 0.16) }]}>
          <SymbolView name={def.icon} tintColor={color} size={15} />
        </View>
        <Text style={styles.label} numberOfLines={1}>
          {def.label}
        </Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, value == null && styles.empty]} numberOfLines={1} adjustsFontSizeToFit>
          {value != null ? def.format(value) : '--'}
        </Text>
        {value != null ? <Text style={styles.unit}>{def.unit}</Text> : null}
      </View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Sparkline values={week} color={color} width={w} />
      </View>
      {status ? <StatusChip status={status} /> : <Text style={styles.noStatus}>{value == null ? 'No data' : ' '}</Text>}
    </Pressable>
  );
}

export function StatusChip({ status }: { status: MetricStatus }) {
  const colors = useColors();
  const styles = useStyles();
  const color = status.tone === 'good' ? colors.recovery.green : status.tone === 'bad' ? colors.recovery.red : colors.muted;
  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(color, 0.14) }]}>
      <Text style={[styles.chipText, { color: status.tone === 'neutral' ? colors.text : color }]}>{status.label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  tile: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    minHeight: 150,
  },
  pressed: { opacity: 0.7 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, color: colors.text, fontFamily: fonts.bodySemi, fontSize: 13 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { color: colors.text, fontFamily: fonts.number, fontSize: 30, fontVariant: ['tabular-nums'], flexShrink: 1 },
  empty: { color: colors.muted },
  unit: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 11 },
  noStatus: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11, paddingVertical: 3 },
}));
