import type { RecoveryZone } from '@fitness/scoring';
import type { TextStyle } from 'react-native';

/**
 * Design tokens. The reasoning behind them is in design-system/my-fitness-app/MASTER.md.
 * Screens should use these names, not raw hex values.
 */

type Gradient = readonly [string, string];

/**
 * No blue or navy anywhere: a near-black page with warm greys, and see-through "glass" cards that
 * let each screen's color tint show through. Hex values that get an alpha suffix appended
 * (score colors, `muted`, `hrZones`) must stay 6-digit hex.
 */
export const colors = {
  background: '#050505',
  /** Glass card fill, bottom and top of its gradient: white at low opacity over the tinted page. */
  card: 'rgba(255,255,255,0.035)',
  cardHighlight: 'rgba(255,255,255,0.085)',
  /** Top edge of a card, as if lit from above. */
  cardEdge: 'rgba(255,255,255,0.22)',
  /** Solid dark grey, for the few things that can't be see-through (the refresh spinner's disc). */
  surface: '#1C1A19',
  /** Floating tab bar: dark glass, so the moving background still shows through a little. */
  tabBar: 'rgba(16,15,14,0.86)',
  /** The pill behind the selected tab icon. */
  tabActive: 'rgba(255,255,255,0.12)',
  border: 'rgba(255,255,255,0.10)',
  text: '#FAFAF9',
  muted: '#A8A29E',
  /** Empty part of rings and bars. */
  track: 'rgba(255,255,255,0.10)',
  strain: '#FF8A1F',
  sleep: '#9D7CFF',
  recovery: {
    green: '#2ED573',
    yellow: '#F5C518',
    red: '#FF4757',
  } satisfies Record<RecoveryZone, string>,
  sleepStages: {
    awake: '#E7E5E4',
    light: '#8A6CF0',
    deep: '#5A3CC8',
    rem: '#C9B2FF',
  },
  /**
   * Third light in the moving background, following the clock so the app looks different through
   * the day: amber at dawn, coral in the day, pink at dusk, violet at night. Still no blue.
   */
  timeOfDay: {
    dawn: '#FFB36B',
    day: '#FF9E7A',
    dusk: '#FF6FA3',
    night: '#7B5CFF',
  },
  /** Line charts on the Recovery screen. */
  hrv: '#2ED573',
  restingHr: '#FF6B81',
  /** Heart-rate zones 1–5, easy to hard. */
  hrZones: ['#78716C', '#2ED573', '#F5C518', '#FF8A1F', '#FF4757'],
};

/** Two-stop gradients, light end first. The dark end matches the flat color above. */
export const gradients = {
  strain: ['#FFC078', colors.strain],
  sleep: ['#D2C2FF', colors.sleep],
  recovery: {
    green: ['#8BF7B4', colors.recovery.green],
    yellow: ['#FFE483', colors.recovery.yellow],
    red: ['#FF97A0', colors.recovery.red],
  } satisfies Record<RecoveryZone, Gradient>,
  card: [colors.cardHighlight, colors.card],
  neutral: ['#E7E5E4', colors.muted],
} as const;

/** `hex` (6-digit) at `opacity` 0–1, as 8-digit hex. */
export function withAlpha(hex: string, opacity: number): string {
  return `${hex}${Math.round(Math.min(Math.max(opacity, 0), 1) * 255).toString(16).padStart(2, '0')}`;
}

export type TimeOfDay = keyof typeof colors.timeOfDay;

/** Which part of the day `hour` (0–23, the phone's local time) falls in. */
export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 10) return 'dawn';
  if (hour >= 10 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'dusk';
  return 'night';
}

/** The background's time-of-day color for `hour`. */
export function timeOfDayTint(hour: number): string {
  return colors.timeOfDay[timeOfDay(hour)];
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
  /** One drift of a background light; each light uses a different multiple so they never sync up. */
  aurora: 16000,
  /** Tab bar's selected pill sliding between tabs. */
  tabSlide: 260,
};
