import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { fonts, spacing, type, withAlpha, type Palette } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { makeStyles, useColors } from '@/lib/theme';
import type { DayLine, Tone } from '@/lib/yourDay';

export function toneColor(tone: Tone, colors: Palette): string {
  return tone === 'good' ? colors.recovery.green : tone === 'okay' ? colors.recovery.yellow : tone === 'watch' ? colors.recovery.red : colors.text;
}

/**
 * The takeaway at the top of Today (lib/yourDay.ts): body, today, tonight, each a verdict you can
 * read at a glance plus one sentence, opening the screen behind it.
 */
export function YourDayCard({ lines, isLatest }: { lines: DayLine[]; isLatest: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  if (!lines.length) return null;
  return (
    <Card title={isLatest ? 'YOUR DAY' : 'THAT DAY IN SHORT'}>
      {lines.map((l, i) => {
        const color = toneColor(l.tone, colors);
        return (
          <Pressable
            key={l.label}
            onPress={() => {
              tapHaptic();
              router.navigate(l.href);
            }}
            accessibilityRole="link"
            accessibilityLabel={`${l.label}: ${l.verdict}. ${l.text}`}
            style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}>
            <View style={[styles.dot, { backgroundColor: l.tone === 'neutral' ? colors.muted : color }]} />
            <View style={styles.body}>
              <Text style={styles.label}>{l.label}</Text>
              <Text style={[styles.verdict, l.tone !== 'neutral' && { color }]}>{l.verdict}</Text>
              <Text style={styles.text}>{l.text}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={() => {
          tapHaptic();
          router.push('/guide');
        }}
        accessibilityRole="link"
        hitSlop={8}
        style={({ pressed }) => [styles.guide, { backgroundColor: withAlpha(colors.text, 0.06) }, pressed && { opacity: 0.6 }]}>
        <Text style={styles.guideText}>New to the numbers? How to read the app  ›</Text>
      </Pressable>
    </Card>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: spacing.sm },
  divider: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  body: { flex: 1, gap: 2 },
  label: { ...type.overline, color: colors.muted, fontSize: 11 },
  verdict: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
  text: { ...type.body, color: colors.text },
  chevron: { color: colors.muted, fontSize: 22, marginTop: 10 },
  guide: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: spacing.xs },
  guideText: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 13 },
}));
