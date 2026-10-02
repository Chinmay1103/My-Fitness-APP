import { router } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/tabs';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import { useContext, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Aurora } from '@/components/Aurora';
import { SceneBackdrop } from '@/components/SceneBackdrop';
import { colors, gradients, radius, spacing, type } from '@/constants/theme';
import { useBackgroundStyle } from '@/lib/backgroundStyle';
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
  /** The screen's main color for the moving background (e.g. today's recovery zone); grey if left out. */
  glow?: string;
  /** A second background color lower down; the time-of-day color if left out. */
  glow2?: string;
};

/**
 * Scrollable screen with pull-to-refresh and shared loading and error states.
 * Navigator headers are hidden app-wide; every screen draws its own title here, so the glow runs
 * all the way up behind the status bar instead of stopping under a flat header bar.
 */
export function Screen({ children, overline, title, accessory, back, glow, glow2 }: ScreenProps) {
  const { loading, error, scores, refresh } = useScores();
  const backgroundStyle = useBackgroundStyle();
  const insets = useSafeAreaInsets();
  // The tab bar floats over the content (see app/(tabs)/_layout.tsx); undefined outside the tabs.
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? insets.bottom;

  if (loading && scores.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {backgroundStyle === 'scenes' ? (
        <SceneBackdrop color={glow ?? colors.muted} />
      ) : (
        <Aurora color={glow ?? colors.muted} second={glow2} strength={glow ? 1 : 0.7} />
      )}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: tabBarHeight + spacing.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              refreshHaptic();
              refresh();
            }}
            // On Android the spinner would sit on top of the title; drop it just below instead.
            progressViewOffset={insets.top + 64}
            tintColor={colors.text}
            colors={[colors.strain]}
            progressBackgroundColor={colors.surface}
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

/**
 * Glass tile: a see-through white gradient (a little brighter at the top) with a lit top edge,
 * so the screen's color tint shows through and the card still reads as a raised pane.
 */
export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <LinearGradient colors={gradients.card} style={styles.cardFill} />
      {title ? (
        <Text style={styles.cardTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
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

/** Small outlined label, e.g. "Demo data" or an example question. Tappable when given `onPress`. */
export function Pill({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const text = <Text style={styles.pillText}>{children}</Text>;
  if (!onPress) return <View style={styles.pill}>{text}</View>;
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
      {text}
    </Pressable>
  );
}

/** Selectable option, e.g. a workout type. The selected one is filled. */
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** Text field in the app's style. */
export function Input({ style, ...props }: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, style]} />;
}

export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** 'secondary' is outlined, for less important actions next to a primary one. */
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        (pressed || disabled) && styles.pressed,
      ]}>
      <Text style={[styles.buttonText, variant === 'secondary' && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
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
  content: { padding: spacing.md, gap: spacing.md },
  header: { gap: 2, marginBottom: spacing.xs },
  back: { alignSelf: 'flex-start', marginLeft: -2, marginBottom: spacing.sm },
  overline: { ...type.overline, color: colors.muted },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', columnGap: 8 },
  title: { ...type.hero, color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  error: { ...type.body, color: colors.recovery.red },
  card: {
    borderColor: colors.border,
    borderTopColor: colors.cardEdge,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    gap: spacing.md,
  },
  cardFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius.lg },
  cardTitle: { ...type.overline, color: colors.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  stat: { flex: 1, gap: 2 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { ...type.caption, color: colors.muted },
  statValue: { ...type.stat, color: colors.text },
  statHint: { ...type.caption, fontSize: 11, color: colors.muted },
  muted: { ...type.body, color: colors.muted },
  pill: {
    alignSelf: 'flex-start',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: { ...type.caption, color: colors.muted },
  pressed: { opacity: 0.6 },
  button: {
    backgroundColor: colors.text,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    minHeight: 44,
  },
  buttonText: { ...type.bodyStrong, color: colors.background },
  buttonSecondary: { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 },
  buttonTextSecondary: { color: colors.text },
  chip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { ...type.caption, fontSize: 13, color: colors.text },
  chipTextSelected: { color: colors.background },
  input: {
    ...type.body,
    fontSize: 16,
    color: colors.text,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 46,
  },
});
