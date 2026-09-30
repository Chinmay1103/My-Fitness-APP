import type { RecoveryZone } from '@fitness/scoring';
import type { TextStyle } from 'react-native';

/**
 * Design tokens. The reasoning behind them is in design-system/my-fitness-app/MASTER.md.
 * Screens should use these names, not raw hex values.
 */

type Gradient = readonly [string, string];

export const colors = {
  background: '#05070D',
  card: '#0C1020',
  /** Top of the card gradient: a lighter navy, so cards read as raised. */
  cardHighlight: '#172038',
  /** Top edge of a card, as if lit from above. */
  cardEdge: 'rgba(255,255,255,0.10)',
  /** Tab bar: see-through, so the screen's gradient carries on behind it. */
  tabBar: 'rgba(5,7,13,0.78)',
  border: '#1E2638',
  text: '#F8FAFC',
  muted: '#94A3B8',
  /** Empty part of rings and bars; light enough to see on a card even when nothing fills it. */
  track: '#252E44',
  strain: '#1E9BF0',
  sleep: '#8E9CF5',
  recovery: {
    green: '#2ED573',
    yellow: '#F5C518',
    red: '#FF4757',
  } satisfies Record<RecoveryZone, string>,
  sleepStages: {
    awake: '#E2E8F0',
    light: '#6C7BD9',
    deep: '#3F4DB8',
    rem: '#B39DF5',
  },
  /** Heart-rate zones 1–5, cool to hot. */
  hrZones: ['#64748B', '#2E86DE', '#2ED573', '#F5A623', '#FF4757'],
};

/** Two-stop gradients, light end first. The dark end matches the flat color above. */
export const gradients = {
  strain: ['#6FD0FF', colors.strain],
  sleep: ['#C3CAFF', colors.sleep],
  recovery: {
    green: ['#8BF7B4', colors.recovery.green],
    yellow: ['#FFE483', colors.recovery.yellow],
    red: ['#FF97A0', colors.recovery.red],
  } satisfies Record<RecoveryZone, Gradient>,
  card: [colors.cardHighlight, colors.card],
  neutral: ['#CBD5E1', colors.muted],
} as const;

/** Drop shadows (CSS syntax, supported by React Native's boxShadow). */
export const shadows = {
  card: '0px 14px 28px -10px rgba(0,0,0,0.75)',
};

/**
 * Full-screen background tint: strongest at the top, never quite gone at the bottom, so the
 * screen's color (e.g. today's recovery zone) washes over the whole page.
 */
export function backdrop(tint: string): { colors: readonly [string, string, string]; locations: readonly [number, number, number] } {
  return { colors: [`${tint}4D`, `${tint}1A`, `${tint}0D`], locations: [0, 0.45, 1] };
}

/** Picks a gradient whose dark end is `color`, falling back to a flat one. */
export function gradientFor(color: string): Gradient {
  const all: Gradient[] = [gradients.strain, gradients.sleep, ...Object.values(gradients.recovery)];
  return all.find((g) => g[1] === color) ?? [color, color];
}

/**
 * Inter for words (titles, labels, body, tab bar); Barlow Condensed only for numbers (ring values,
 * stats, deltas), where a condensed face looks sporty. On words it looks cramped.
 * On Android a custom font must be picked by family name, so don't combine these with fontWeight.
 */
export const fonts = {
  heading: 'Inter_700Bold',
  label: 'Inter_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  number: 'BarlowCondensed_700Bold',
  numberSemi: 'BarlowCondensed_600SemiBold',
};

export const type = {
  hero: { fontFamily: fonts.heading, fontSize: 26, letterSpacing: -0.3 },
  title: { fontFamily: fonts.heading, fontSize: 20 },
  overline: { fontFamily: fonts.label, fontSize: 12, letterSpacing: 1 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
  /** Keep tabular digits on numbers that change, so they don't wobble during count-up. */
  stat: { fontFamily: fonts.number, fontSize: 24, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 4, md: 12, lg: 20 };

/** Durations in ms. Big reveals are slow enough to notice; feedback stays fast. */
export const motion = {
  ring: 1100,
  bars: 650,
  barStagger: 35,
  countUp: 900,
};
