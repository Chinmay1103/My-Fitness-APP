import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, gradients, radius, spacing, type } from '@/constants/theme';
import { refreshHaptic } from '@/lib/haptics';
import { useScores } from '@/lib/ScoresProvider';

/**
 * Scrollable screen with pull-to-refresh and shared loading and error states.
 * `glow` tints the top of the screen with the screen's main color (e.g. today's recovery zone).
 */
export function Screen({ children, glow }: { children: ReactNode; glow?: string }) {
  const { loading, error, scores, refresh } = useScores();

  if (loading && scores.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {glow ? (
        <LinearGradient
          pointerEvents="none"
          colors={[`${glow}33`, `${glow}00`]}
          style={styles.glow}
        />
      ) : null}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              refreshHaptic();
              refresh();
            }}
            tintColor={colors.text}
            colors={[colors.strain]}
            progressBackgroundColor={colors.card}
          />
        }>
        {error ? <Text style={styles.error}>Couldn't load health data: {error}</Text> : null}
        {children}
      </ScrollView>
    </View>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <LinearGradient colors={gradients.card} style={styles.card}>
      {title ? (
        <Text style={styles.cardTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </LinearGradient>
  );
}

export function Stat({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statLabelRow}>
        {color ? <View style={[styles.statDot, { backgroundColor: color }]} /> : null}
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 360 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  error: { ...type.body, color: colors.recovery.red },
  card: {
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    gap: spacing.md,
  },
  cardTitle: { ...type.overline, color: colors.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  stat: { flex: 1, gap: 2 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { ...type.caption, color: colors.muted },
  statValue: { ...type.stat, color: colors.text },
  statHint: { ...type.caption, fontSize: 11, color: colors.muted },
  muted: { ...type.body, color: colors.muted },
});
