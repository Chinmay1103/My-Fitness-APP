import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useColors } from '@/lib/theme';

/**
 * The app's logo, the same drawing as the app icon (logos/export/logo.svg): a heartbeat line
 * through a ring with an orange progress arc. `tile` draws it on its dark rounded square, like the
 * icon; without it, just the mark, in the theme's colors so it sits on light or dark pages.
 */
export function Logo({ size = 32, tile = false }: { size?: number; tile?: boolean }) {
  const colors = useColors();
  const onDark = tile || colors.scheme === 'dark';
  const track = onDark ? '#2A2725' : colors.track;
  const pulse = onDark ? '#FAFAF9' : colors.text;
  // Without the tile the mark fills more of the box.
  const viewBox = tile ? '0 0 512 512' : '88 88 336 336';
  return (
    <Svg width={size} height={size} viewBox={viewBox} accessibilityRole="image" accessibilityLabel="My Fitness">
      <Defs>
        <LinearGradient id="logoArc" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFC078" />
          <Stop offset="1" stopColor="#FF8A1F" />
        </LinearGradient>
      </Defs>
      {tile ? <Rect width={512} height={512} rx={112} fill="#0B0A09" /> : null}
      <Circle cx={256} cy={256} r={150} stroke={track} strokeWidth={36} fill="none" />
      <Path d="M256 106 A150 150 0 0 1 398 208" stroke="url(#logoArc)" strokeWidth={36} strokeLinecap="round" fill="none" />
      <Path
        d="M118 266 H196 L222 202 L262 326 L296 236 L316 266 H394"
        stroke={pulse}
        strokeWidth={34}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
