import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, spacing, type } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import type { Help } from '@/lib/help';
import { makeStyles, useColors } from '@/lib/theme';

/** The (?) button for a screen's header: opens "How to read this" (lib/help.ts) from the bottom. */
export function HelpButton({ help }: { help: Help }) {
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
        accessibilityLabel="How to read this screen"
        hitSlop={12}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}>
        <SymbolView name={{ ios: 'questionmark', android: 'question_mark', web: 'question_mark' }} tintColor={colors.text} size={20} />
      </Pressable>
      {open ? <HelpSheet help={help} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function HelpSheet({ help, onClose }: { help: Help; onClose: () => void }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const shown = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(shown, { toValue: 1, duration: reduceMotion ? 0 : 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [shown, reduceMotion]);

  const close = (then?: () => void) => {
    Animated.timing(shown, { toValue: 0, duration: reduceMotion ? 0 : 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      onClose();
      then?.();
    });
  };

  const sections = [
    { heading: 'What it is', body: help.what },
    { heading: 'What’s good', body: help.good },
    ...(help.you ? [{ heading: 'For you', body: help.you }] : []),
    { heading: 'What to do with it', body: help.act },
  ];

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={() => close()} animationType="none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: shown }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { maxHeight: height * 0.8, paddingBottom: insets.bottom + spacing.md },
          { transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [height * 0.6, 0] }) }] },
        ]}>
        <View style={styles.grip} />
        <Text style={styles.title} accessibilityRole="header">
          {help.title}
        </Text>
        <ScrollView contentContainerStyle={styles.list}>
          {sections.map((s) => (
            <View key={s.heading} style={styles.section}>
              <Text style={styles.heading}>{s.heading.toUpperCase()}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
          <Pressable
            onPress={() => {
              tapHaptic();
              close(() => router.push('/guide'));
            }}
            accessibilityRole="link"
            style={({ pressed }) => [styles.guide, pressed && { opacity: 0.6 }]}>
            <Text style={styles.guideText}>How to read the whole app  ›</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  button: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.track },
  scrim: { backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.track, marginBottom: spacing.md },
  title: { ...type.title, color: colors.text, marginBottom: spacing.sm },
  list: { gap: spacing.md, paddingBottom: spacing.sm },
  section: { gap: 4 },
  heading: { ...type.overline, color: colors.muted },
  body: { ...type.body, color: colors.text },
  guide: { alignSelf: 'flex-start', borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  guideText: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 13 },
}));
