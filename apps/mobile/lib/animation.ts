import { useEffect, useState } from 'react';
import { Easing, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

export const easeOut = Easing.out(Easing.cubic);

/**
 * A 0→`target` shared value that animates whenever `target` changes (first render, refresh).
 * Jumps straight to the value when the phone's "reduce motion" setting is on.
 */
export function useAnimatedTarget(target: number, duration: number, delay = 0) {
  const reduced = useReducedMotion();
  const value = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    value.value = reduced ? target : withDelay(delay, withTiming(target, { duration, easing: easeOut }));
  }, [target, duration, delay, reduced, value]);
  return value;
}

/**
 * Counts a number up from 0 for the middle of a ring. Runs on the JS thread, which is fine for a
 * handful of numbers on screen. Returns the target straight away when "reduce motion" is on.
 */
export function useCountUp(target: number, duration: number) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      setShown(target);
      return;
    }
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      setShown(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);
  return shown;
}
