import Svg, { Circle, Path } from 'react-native-svg';

import { smoothPath } from './parts';

/**
 * A tiny trend line for a metric tile: the last few days, today's point marked. No axes or
 * labels; the tile around it gives the numbers. Gaps (days without data) are skipped.
 */
export function Sparkline({ values, color, width, height = 28 }: { values: (number | null)[]; color: string; width: number; height?: number }) {
  const known = values.flatMap((v, i) => (v != null ? [{ v, i }] : []));
  if (known.length < 2 || width <= 0) return <Svg width={width} height={height} />;
  const min = Math.min(...known.map((k) => k.v));
  const max = Math.max(...known.map((k) => k.v));
  const span = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);
  const pts = known.map((k) => ({ x: k.i * step, y: 3 + (1 - (k.v - min) / span) * (height - 6) }));
  const last = pts.at(-1)!;
  return (
    <Svg width={width} height={height}>
      <Path d={smoothPath(pts)} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.85} />
      <Circle cx={Math.min(last.x, width - 3)} cy={last.y} r={3} fill={color} />
    </Svg>
  );
}
