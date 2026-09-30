import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, gradients, radius, spacing, type } from '@/constants/theme';
import { refreshHaptic, tapHaptic } from '@/lib/haptics';
import { useScores } from '@/lib/ScoresProvider';

type ScreenProps = {
  children: ReactNode;
  /** Small uppercase label above the title, e.g. "SLEEP". */
  overline?: string;
  title?: string;
  /** Shown to the right of the title, e.g. the "Demo data" label. */
  accessory?: ReactNode;
  /** Show a back arrow (for screens pushed on top of the tabs). */
  back?: boolean;
  /** Tints the top of the screen with the screen's main color (e.g. today's recovery zone). */
  glow?: string;
};

/**
 * Scrollable screen with pull-to-refresh and shared loading and error states.
 * Navigator headers are hidden app-wide; every screen draws its own title here, so the glow runs
 * all the way up behind the status bar instead of stopping under a flat header bar.
 */
export function Screen({ children, overline, title, accessory, back, glow }: ScreenProps) {
  const { loading, error, scores, refresh } = useScores();
  const insets = useSafeAreaInsets();

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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
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
        {back || overline || title ? (
          <View style={styles.header}>
            {back ? (
              <Pressable
                onPress={() => {
                  tapHaptic();
                  router.back();
                }}
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={12}
                style={styles.back}>
                <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor={colors.text} size={24} />
              </Pressable>
            ) : null}
            {overline ? <Text style={styles.overline}>{overline}</Text> : null}
            <View style={styles.titleRow}>
              {title ? (
                <Text style={styles.title} accessibilityRole="header">
                  {title}
                </Text>
              ) : null}
              {accessory}
            </View>
          </View>
        ) : null}
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
  header: { gap: 2, marginBottom: spacing.xs },
  back: { alignSelf: 'flex-start', marginLeft: -2, marginBottom: spacing.sm },
  overline: { ...type.overline, color: colors.muted },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', columnGap: 8 },
  title: { ...type.hero, color: colors.text },
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
