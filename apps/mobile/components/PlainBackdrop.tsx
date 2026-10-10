import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { withAlpha } from '@/constants/theme';
import { useColors } from '@/lib/theme';

/**
 * The "Plain" background: the flat page with one still, soft wash of the screen's color across the
 * top, fading out before the cards. No photo, no movement. Also what light mode shows when Scenes
 * is picked, since the photos are dark-toned and turn muddy under a light page.
 */
export function PlainBackdrop({ color }: { color: string }) {
  const colors = useColors();
  const light = colors.scheme === 'light';
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[withAlpha(color, light ? 0.2 : 0.18), withAlpha(color, light ? 0.06 : 0.05), withAlpha(color, 0)]}
      locations={[0, 0.25, 0.5]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.4, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
