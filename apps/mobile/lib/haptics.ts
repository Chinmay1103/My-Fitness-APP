import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * The few vibrations the app uses, so they stay consistent. Kept light on purpose:
 * a tap confirms a touch, it shouldn't feel like a notification. Does nothing on web.
 */
const enabled = Platform.OS !== 'web';

/** Tapping something that opens more detail, or switching tabs. */
export function tapHaptic() {
  if (enabled) Haptics.selectionAsync().catch(() => {});
}

/** Pull-to-refresh kicked off. */
export function refreshHaptic() {
  if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
