import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';

const POSITIVE = colors.recovery.green;
const NEGATIVE = colors.recovery.red;

/**
 * "Start value, then what each factor added or took off, then the result" list.
 * Used to show how every score was reached.
 */
export function Breakdown({ children }: { children: ReactNode }) {
  return <View style={styles.list}>{children}</View>;
}

/** The starting point (e.g. "Typical night for you: 57%") or the final result. */
export function BreakdownTotal({ label, value, color, detail }: { label: string; value: string; color?: string; detail?: string }) {
  return (
    <View style={styles.total}>
      <View style={styles.text}>
        <Text style={styles.totalLabel}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      <Text style={[styles.totalValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

interface FactorProps {
  label: string;
  /** Plain-language explanation, e.g. "58 ms vs your usual 52 ms". */
  detail: string;
  /** Points added (positive) or taken off (negative). */
  delta: number;
  /** Largest |delta| on the list, to scale the bars. */
  scale: number;
  decimals?: number;
  unit?: string;
  /** Fixed color, for lists where more isn't good or bad (strain, minutes of sleep need). */
  color?: string;
}

export function BreakdownFactor({ label, detail, delta, scale, decimals = 0, unit = '', color: fixedColor }: FactorProps) {
  const rounded = Number(delta.toFixed(decimals));
  const color = rounded === 0 ? colors.muted : fixedColor ? fixedColor : rounded > 0 ? POSITIVE : NEGATIVE;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±';
  return (
    <View style={styles.factor}>
      <View style={styles.factorTop}>
        <View style={styles.text}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
        <Text style={[styles.delta, { color }]}>
          {sign}
          {Math.abs(rounded).toFixed(decimals)}
          {unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={{ width: `${Math.min(Math.abs(delta) / Math.max(scale, 1e-6), 1) * 100}%`, backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  text: { flex: 1, gap: 2 },
  total: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  totalLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  totalValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  factor: { gap: 6, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border },
  factorTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  detail: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  delta: { fontSize: 17, fontWeight: '800', minWidth: 48, textAlign: 'right' },
  track: { height: 5, flexDirection: 'row', backgroundColor: colors.track, borderRadius: 3, overflow: 'hidden' },
});
