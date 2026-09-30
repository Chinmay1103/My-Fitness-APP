import type { RecoveryZone } from '@fitness/scoring';

/**
 * Design tokens. The reasoning behind them is in design-system/my-fitness-app/MASTER.md.
 * Screens should use these names, not raw hex values.
 */

type Gradient = readonly [string, string];

export const colors = {
  background: '#05070D',
  card: '#0E1223',
  /** Top of the card gradient: a slightly lighter navy, so cards read as raised. */
  cardHighlight: '#141A30',
  border: '#1E2638',
  text: '#F8FAFC',
  muted: '#94A3B8',
  track: '#1B2233',
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

/** Picks a gradient whose dark end is `color`, falling back to a flat one. */
export function gradientFor(color: string): Gradient {
  const all: Gradient[] = [gradients.strain, gradients.sleep, ...Object.values(gradients.recovery)];
  return all.find((g) => g[1] === color) ?? [color, color];
}

/**
 * Barlow Condensed for numbers and headings (compact, sporty), Barlow for body text.
 * On Android a custom font must be picked by family name, so don't combine these with fontWeight.
 */
export const fonts = {
  display: 'BarlowCondensed_700Bold',
  displaySemi: 'BarlowCondensed_600SemiBold',
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodySemi: 'Barlow_600SemiBold',
};

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 30, letterSpacing: 0.2 },
  title: { fontFamily: fonts.display, fontSize: 22 },
  overline: { fontFamily: fonts.displaySemi, fontSize: 13, letterSpacing: 1.4 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
  stat: { fontFamily: fonts.display, fontSize: 24 },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 4, md: 12, lg: 20 };

/** Durations in ms. Big reveals are slow enough to notice; feedback stays fast. */
export const motion = {
  ring: 1100,
  bars: 650,
  barStagger: 35,
  chart: 900,
  countUp: 900,
};
