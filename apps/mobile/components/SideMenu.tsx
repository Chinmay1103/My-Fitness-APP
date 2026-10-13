import { router, usePathname, type Href } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { useHorizontalSwipe } from '@/components/Swipe';
import { fonts, spacing, type } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { DASHBOARD_ORDER, METRICS } from '@/lib/metrics';
import { makeStyles, useColors } from '@/lib/theme';
import { TRENDS, type TrendKey } from '@/lib/trends';

/**
 * The side menu: every screen in the app in one list, grouped, with the one you're on lit up, so
 * nothing is more than two taps away and you can always see where you are. Opened from the ☰
 * button in every screen's header; closes on a tap outside, a swipe left or the back button.
 */

type SymbolNames = Extract<SymbolViewProps['name'], object>;
const icon = (ios: SymbolNames['ios'], android: SymbolNames['android']): SymbolNames => ({ ios, android, web: android });

interface Item {
  label: string;
  /** The URL path, to light up the screen you're on. */
  path: string;
  href: Href;
  icon: SymbolNames;
}

interface Section {
  title: string;
  items: Item[];
  /** Long lists start folded unless you're on one of their screens. */
  foldable?: boolean;
}

const page = (label: string, path: string, ios: SymbolNames['ios'], android: SymbolNames['android']): Item => ({
  label,
  path,
  href: path as Href,
  icon: icon(ios, android),
});

const SECTIONS: Section[] = [
  {
    title: 'HELP',
    items: [page('Start here: how to read the app', '/guide', 'book', 'menu_book')],
  },
  {
    title: 'SCORES',
    items: [
      page('Today', '/', 'gauge.with.needle', 'readiness_score'),
      page('Recovery', '/recovery', 'battery.100percent.bolt', 'battery_charging_full'),
      page('Sleep', '/sleep', 'moon.stars', 'nights_stay'),
      page('Strain', '/strain', 'flame', 'local_fire_department'),
    ],
  },
  {
    title: 'HEART',
    items: [
      page('Heart rate today', '/heart-rate', 'heart.fill', 'favorite'),
      page('Live heart rate', '/live', 'waveform.path.ecg', 'monitor_heart'),
    ],
  },
  {
    title: 'TRAINING',
    items: [
      page('Workouts', '/workouts', 'dumbbell.fill', 'fitness_center'),
      page('Weekly report', '/weekly', 'calendar', 'calendar_month'),
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      page('Body age', '/body-age', 'figure.walk', 'directions_walk'),
      page('Body check', '/body-check', 'stethoscope', 'health_and_safety'),
      page('Habits', '/habits', 'checklist', 'checklist'),
    ],
  },
  {
    title: 'METRICS',
    foldable: true,
    items: DASHBOARD_ORDER.map((key) => ({
      label: METRICS[key].label,
      path: `/metric/${key}`,
      href: { pathname: '/metric/[key]', params: { key } },
      icon: METRICS[key].icon,
    })),
  },
  {
    title: 'SLEEP DETAILS',
    foldable: true,
    items: (Object.keys(TRENDS) as TrendKey[]).map((key) => ({
      label: TRENDS[key].label,
      path: `/trend/${key}`,
      href: { pathname: '/trend/[key]', params: { key } },
      icon: TRENDS[key].icon,
    })),
  },
  {
    title: 'COACH & SETTINGS',
    items: [
      page('Coach', '/coach', 'brain.head.profile', 'psychology'),
      page('Account', '/account', 'person.crop.circle', 'account_circle'),
      page('Health data', '/health', 'heart.text.square', 'heart_check'),
    ],
  },
];

const PANEL_MAX = 320;

/** The ☰ button for a screen's header; owns its menu. */
export function MenuButton() {
  const colors = useColors();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => {
          tapHaptic();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Menu: all screens"
        hitSlop={12}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}>
        <SymbolView name={icon('line.3.horizontal', 'menu')} tintColor={colors.text} size={24} />
      </Pressable>
      {open ? <SideMenu onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SideMenu({ onClose }: { onClose: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const panelW = Math.min(PANEL_MAX, width * 0.84);
  const shown = useRef(new Animated.Value(0)).current;
  const [folded, setFolded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.filter((s) => s.foldable).map((s) => [s.title, !s.items.some((i) => i.path === pathname)])),
  );

  useEffect(() => {
    Animated.timing(shown, { toValue: 1, duration: reduceMotion ? 0 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [shown, reduceMotion]);

  const close = (then?: () => void) => {
    Animated.timing(shown, { toValue: 0, duration: reduceMotion ? 0 : 160, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      onClose();
      then?.();
    });
  };
  const swipe = useHorizontalSwipe((direction) => direction === 'left' && close());

  const go = (item: Item) => {
    tapHaptic();
    if (item.path === pathname) return close();
    close(() => router.navigate(item.href));
  };

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={() => close()} animationType="none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: shown }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Close menu" />
      </Animated.View>
      <Animated.View
        {...swipe}
        style={[
          styles.panel,
          { width: panelW, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom },
          { transform: [{ translateX: shown.interpolate({ inputRange: [0, 1], outputRange: [-panelW, 0] }) }] },
        ]}>
        <View style={styles.brand}>
          <Logo size={26} />
          <Text style={styles.brandText}>My Fitness</Text>
          <Pressable onPress={() => close()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close menu" style={styles.closeButton}>
            <SymbolView name={icon('xmark', 'close')} tintColor={colors.muted} size={22} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {SECTIONS.map((section) => {
            const isFolded = folded[section.title];
            return (
              <View key={section.title} style={styles.section}>
                {section.foldable ? (
                  <Pressable
                    onPress={() => {
                      tapHaptic();
                      setFolded((f) => ({ ...f, [section.title]: !f[section.title] }));
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !isFolded }}
                    style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{`${section.title} · ${section.items.length}`}</Text>
                    <SymbolView name={icon(isFolded ? 'chevron.down' : 'chevron.up', isFolded ? 'expand_more' : 'expand_less')} tintColor={colors.muted} size={18} />
                  </Pressable>
                ) : (
                  <Text style={[styles.sectionTitle, styles.sectionHeader]}>{section.title}</Text>
                )}
                {isFolded
                  ? null
                  : section.items.map((item) => {
                      const here = item.path === pathname;
                      return (
                        <Pressable
                          key={item.path}
                          onPress={() => go(item)}
                          accessibilityRole="link"
                          accessibilityState={{ selected: here }}
                          style={({ pressed }) => [styles.row, here && styles.rowHere, pressed && { opacity: 0.6 }]}>
                          <SymbolView name={item.icon} tintColor={here ? colors.text : colors.muted} size={20} />
                          <Text style={[styles.rowText, here && styles.rowTextHere]} numberOfLines={1}>
                            {item.label}
                          </Text>
                          {here ? <Text style={styles.hereTag}>You’re here</Text> : null}
                        </Pressable>
                      );
                    })}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  button: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.track },
  scrim: { backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.surface,
    borderRightColor: colors.border,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  brandText: { ...type.title, color: colors.text, flex: 1 },
  closeButton: { padding: 4 },
  list: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xl },
  section: { marginBottom: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  sectionTitle: { ...type.overline, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.sm, paddingVertical: 11, borderRadius: 10 },
  rowHere: { backgroundColor: colors.tabActive },
  rowText: { flex: 1, color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 15 },
  rowTextHere: { fontFamily: fonts.bodySemi },
  hereTag: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11 },
}));
