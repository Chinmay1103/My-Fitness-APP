import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, type GestureResponderHandlers } from 'react-native';

import { dayName } from '@/components/charts/parts';
import { colors, fonts } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useSelectedDay } from '@/lib/ScoresProvider';

/** 'left' means the finger moved right to left, so "next": the tab to the right, or the newer day. */
export type SwipeDirection = 'left' | 'right';

const CLAIM_PX = 16;
const SWIPE_PX = 60;
const SWIPE_VELOCITY = 0.4;

/**
 * Left/right swipes on whatever gets the returned handlers. It only takes over a touch once it's
 * clearly sideways, so vertical scrolling and pull-to-refresh still work. The innermost swipe area
 * wins: charts (which claim touches for their scrubber) beat the day pager, and the day pager beats
 * the tab swipe on the whole screen.
 */
export function useHorizontalSwipe(
  onSwipe: (direction: SwipeDirection) => void,
  onDrag?: (dx: number) => void,
): GestureResponderHandlers {
  const latest = useRef({ onSwipe, onDrag });
  latest.current = { onSwipe, onDrag };
  return useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > CLAIM_PX && Math.abs(g.dx) > 2 * Math.abs(g.dy),
        onPanResponderMove: (_, g) => latest.current.onDrag?.(g.dx),
        onPanResponderRelease: (_, g) => {
          latest.current.onDrag?.(0);
          if (Math.abs(g.dx) > SWIPE_PX || Math.abs(g.vx) > SWIPE_VELOCITY) {
            latest.current.onSwipe(g.dx < 0 ? 'left' : 'right');
          }
        },
        onPanResponderTerminate: () => latest.current.onDrag?.(0),
        onPanResponderTerminationRequest: () => true,
      }).panHandlers,
    [],
  );
}

/**
 * Swipe the content (the score rings) right for the day before, left for the day after, like
 * turning pages back. The arrows below do the same for anyone who doesn't swipe.
 */
export function DayPager({ children }: { children?: ReactNode }) {
  const { score, isLatest, dayBack, setDayBack, count } = useSelectedDay();
  const shift = useRef(new Animated.Value(0)).current;
  const canOlder = dayBack < count - 1;
  const canNewer = dayBack > 0;

  const step = (delta: number) => {
    if ((delta > 0 && !canOlder) || (delta < 0 && !canNewer)) return;
    tapHaptic();
    setDayBack(dayBack + delta);
  };

  const handlers = useHorizontalSwipe(
    (direction) => step(direction === 'right' ? 1 : -1),
    (dx) => {
      if (dx === 0) {
        Animated.spring(shift, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        return;
      }
      // Follows the finger a little; barely moves when there's no day that way.
      const open = dx > 0 ? canOlder : canNewer;
      shift.setValue(dx * (open ? 0.35 : 0.08));
    },
  );

  return (
    <View {...handlers}>
      {children ? <Animated.View style={{ transform: [{ translateX: shift }] }}>{children}</Animated.View> : null}
      <View style={styles.row}>
        <StepButton icon="left" label="Previous day" disabled={!canOlder} onPress={() => step(1)} />
        <Text style={styles.label} accessibilityLiveRegion="polite">
          {score ? dayName(score.date, isLatest) : ''}
          {isLatest ? <Text style={styles.hint}>{'  ·  swipe for other days'}</Text> : null}
        </Text>
        <StepButton icon="right" label="Next day" disabled={!canNewer} onPress={() => step(-1)} />
      </View>
    </View>
  );
}

export function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'left' | 'right';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const name =
    icon === 'left'
      ? ({ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' } as const)
      : ({ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' } as const);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={10}
      style={({ pressed }) => [styles.stepButton, (disabled || pressed) && styles.dim]}>
      <SymbolView name={name} tintColor={colors.text} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  label: { flex: 1, textAlign: 'center', color: colors.text, fontFamily: fonts.bodySemi, fontSize: 14 },
  hint: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  stepButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.35 },
});
