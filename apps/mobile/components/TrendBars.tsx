import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { shortDay } from '@/lib/format';

interface Props {
  points: { date: string; value: number | null; color?: string }[];
  max: number;
  color: string;
  height?: number;
}

/** Simple daily bar chart. A proper charting library comes with the trends work in milestone 5. */
export function TrendBars({ points, max, color, height = 96 }: Props) {
  return (
    <View style={styles.row}>
      {points.map((p) => (
        <View key={p.date} style={styles.col}>
          <View style={[styles.track, { height }]}>
            {p.value !== null ? (
              <View
                style={{
                  height: Math.max((p.value / max) * height, 2),
                  backgroundColor: p.color ?? color,
                  borderRadius: 3,
                }}
              />
            ) : null}
          </View>
          <Text style={styles.day}>{shortDay(p.date)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  col: { flex: 1, alignItems: 'stretch', gap: 4 },
  track: { justifyContent: 'flex-end' },
  day: { color: colors.muted, fontSize: 10, textAlign: 'center' },
});
