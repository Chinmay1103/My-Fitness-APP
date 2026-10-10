import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { fonts, spacing, type, withAlpha, type Palette } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import type { NextStep, NextStepKind } from '@/lib/nextSteps';
import { makeStyles, useColors } from '@/lib/theme';

type SymbolNames = Extract<SymbolViewProps['name'], object>;
const ICONS: Record<NextStepKind, { icon: SymbolNames; color: (c: Palette) => string }> = {
  breathing: { icon: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }, color: (c) => c.recovery.red },
  train: { icon: { ios: 'bolt.heart.fill', android: 'bolt', web: 'bolt' }, color: (c) => c.strain },
  sleep: { icon: { ios: 'moon.fill', android: 'bedtime', web: 'bedtime' }, color: (c) => c.sleep },
  steps: { icon: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }, color: (c) => c.steps },
  cardio: { icon: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }, color: (c) => c.strain },
  protein: { icon: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }, color: (c) => c.recovery.green },
  log: { icon: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }, color: (c) => c.muted },
};

/** Today's "what to do next": up to four suggestions from the scores, each opening where it came from. */
export function NextStepsCard({ steps }: { steps: NextStep[] }) {
  const colors = useColors();
  const styles = useStyles();
  if (!steps.length) return null;
  return (
    <Card title="NEXT STEPS">
      {steps.map((s, i) => {
        const { icon, color } = ICONS[s.kind];
        const tint = color(colors);
        return (
          <Pressable
            key={s.kind}
            onPress={() => {
              tapHaptic();
              router.push(s.href);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${s.title}. ${s.detail}`}
            style={({ pressed }) => [styles.step, i > 0 && styles.divider, pressed && styles.pressed]}>
            <View style={[styles.icon, { backgroundColor: withAlpha(tint, 0.16) }]}>
              <SymbolView name={icon} tintColor={tint} size={18} />
            </View>
            <View style={styles.text}>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.detail}>{s.detail}</Text>
            </View>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={colors.muted} size={16} />
          </Pressable>
        );
      })}
    </Card>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: 2 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  pressed: { opacity: 0.6 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  detail: { ...type.body, fontSize: 13, lineHeight: 18, color: colors.muted },
}));
