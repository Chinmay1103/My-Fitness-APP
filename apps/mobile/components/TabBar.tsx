import type { BottomTabBarProps } from 'expo-router/tabs';
import { BottomTabBarHeightCallbackContext } from 'expo-router/tabs';
import { useContext, useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';

import { motion } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { easeOut } from '@/lib/animation';

const SLOT = 64;
const BAR_HEIGHT = 60;
const PAD = 6;
/** Gap between the bar and the bottom of the screen (above the system navigation). */
const LIFT = 12;

/**
 * Minimal floating tab bar: a dark glass pill of icons, no labels, with a soft highlight that
 * slides to the selected tab. Hides while the keyboard is open so it doesn't ride up over it.
 * Reports its full height so screens pad their content (see Screen in components/ui.tsx).
 */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const colors = useColors();
  const styles = useStyles();
  const setHeight = useContext(BottomTabBarHeightCallbackContext);
  const reduced = useReducedMotion();
  const keyboardOpen = useKeyboardOpen();
  const bottom = insets.bottom + LIFT;

  useEffect(() => {
    setHeight?.(BAR_HEIGHT + bottom);
  }, [setHeight, bottom]);

  const highlight = useAnimatedStyle(() => ({
    transform: [
      { translateX: reduced ? state.index * SLOT : withTiming(state.index * SLOT, { duration: motion.tabSlide, easing: easeOut }) },
    ],
  }));

  if (keyboardOpen) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <View style={styles.bar}>
        <Animated.View style={[styles.highlight, highlight]} />
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? colors.text : colors.muted;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title}
              style={styles.slot}>
              {options.tabBarIcon?.({ focused, color, size: 24 })}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    padding: PAD,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: colors.tabBar,
    borderColor: colors.border,
    borderTopColor: colors.cardEdge,
    borderWidth: StyleSheet.hairlineWidth,
  },
  highlight: {
    position: 'absolute',
    top: PAD,
    left: PAD,
    width: SLOT,
    height: BAR_HEIGHT - PAD * 2,
    borderRadius: (BAR_HEIGHT - PAD * 2) / 2,
    backgroundColor: colors.tabActive,
  },
  slot: { width: SLOT, alignItems: 'center', justifyContent: 'center' },
}));
