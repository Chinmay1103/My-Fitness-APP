import type { RecoveryZone } from '@fitness/scoring';
import type { TextStyle } from 'react-native';

/**
 * Design tokens. The reasoning behind them is in design-system/my-fitness-app/MASTER.md.
 * Screens should use these names, not raw hex values, and get the palette from `useColors()` /
 * `makeStyles()` in lib/theme.tsx, so they follow light and dark mode.
 */

type Gradient = readonly [string, string];

/**
 * No blue or navy anywhere: a near-black page with warm greys, and flat cards (one solid fill, a
 * hairline border; no glass, gradients or lit edges since Oct 10, which read as too 3D). Gradients
 * stay on the score rings and charts. Hex values that get an alpha suffix appended (score colors,
 * `muted`, `hrZones`) must stay 6-digit hex.
 */
const dark = {
  scheme: 'dark' as 'dark' | 'light',
  background: '#050505',
  /** Card fill: warm dark grey, nearly opaque so text reads on any background, photos included. */
  card: 'rgba(24,22,21,0.86)',
  /** Solid dark grey, for the few things that can't be see-through (the refresh spinner's disc). */
  surface: '#1C1A19',
  /** Floating tab bar: dark glass, so the moving background still shows through a little. */
  tabBar: 'rgba(16,15,14,0.86)',
  /** The pill behind the selected tab icon. */
  tabActive: 'rgba(255,255,255,0.12)',
  border: 'rgba(255,255,255,0.08)',
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
  /** Metric tiles on Today that aren't one of the three scores. */
  steps: '#3DD6C6',
  spo2: '#FF7A9C',
  calories: '#FFB020',
  weight: '#C7B8A8',
  /** Lighter top of each sleep stage's gradient in the hypnogram. */
  sleepStageLight: { awake: '#FFFFFF', rem: '#E4D8FF', light: '#B39DFF', deep: '#8466F0' },
};

export type Palette = typeof dark;

/**
 * Light mode: warm paper instead of near-black, flat white cards, and slightly deeper score colors
 * so they keep their contrast on a light page. Same names as the dark palette.
 */
const light: Palette = {
  scheme: 'light',
  background: '#F4F1EC',
  card: 'rgba(255,255,255,0.9)',
  surface: '#FFFFFF',
  tabBar: 'rgba(255,255,255,0.9)',
  tabActive: 'rgba(28,25,23,0.08)',
  border: 'rgba(28,25,23,0.10)',
  text: '#1C1917',
  muted: '#5F5853',
  track: 'rgba(28,25,23,0.09)',
  strain: '#EE7300',
  sleep: '#7B5AF0',
  recovery: { green: '#14A85A', yellow: '#D49B00', red: '#E5384B' },
  sleepStages: { awake: '#A8A29E', light: '#8A6CF0', deep: '#4F2FC0', rem: '#B49AFF' },
  timeOfDay: { dawn: '#FFB36B', day: '#FF9E7A', dusk: '#FF6FA3', night: '#7B5CFF' },
  hrv: '#14A85A',
  restingHr: '#E5466A',
  hrZones: ['#A8A29E', '#14A85A', '#D49B00', '#EE7300', '#E5384B'],
  steps: '#0FA596',
  spo2: '#E5466A',
  calories: '#D98700',
  weight: '#8C7B6B',
  sleepStageLight: { awake: '#D6D3D1', rem: '#D9CCFF', light: '#B39DFF', deep: '#7457E8' },
};

export const palettes = { dark, light } as const;


/** Two-stop gradients, light end first. The dark end matches the palette's flat color. */
export function gradientsFor(c: Palette) {
  const lightMode = c.scheme === 'light';
  return {
    strain: [lightMode ? '#FFB061' : '#FFC078', c.strain] as Gradient,
    sleep: [lightMode ? '#B9A3FF' : '#D2C2FF', c.sleep] as Gradient,
    recovery: {
      green: [lightMode ? '#5BD98F' : '#8BF7B4', c.recovery.green],
      yellow: [lightMode ? '#FFD34D' : '#FFE483', c.recovery.yellow],
      red: [lightMode ? '#FF7F8C' : '#FF97A0', c.recovery.red],
    } satisfies Record<RecoveryZone, Gradient>,
    neutral: [lightMode ? '#D6D3D1' : '#E7E5E4', c.muted] as Gradient,
  };
}

export type Gradients = ReturnType<typeof gradientsFor>;

/** `hex` (6-digit) at `opacity` 0–1, as 8-digit hex. */
export function withAlpha(hex: string, opacity: number): string {
  return `${hex}${Math.round(Math.min(Math.max(opacity, 0), 1) * 255).toString(16).padStart(2, '0')}`;
}

export type TimeOfDay = keyof Palette['timeOfDay'];

/** Which part of the day `hour` (0–23, the phone's local time) falls in. */
export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 10) return 'dawn';
  if (hour >= 10 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'dusk';
  return 'night';
}

/** The background's time-of-day color for `hour`. */
export function timeOfDayTint(hour: number, c: Palette = dark): string {
  return c.timeOfDay[timeOfDay(hour)];
}

/** Picks a gradient whose dark end is `color`, falling back to a flat one. */
export function gradientFor(color: string, c: Palette = dark): Gradient {
  const g = gradientsFor(c);
  const all: Gradient[] = [g.strain, g.sleep, ...Object.values(g.recovery)];
  return all.find((x) => x[1] === color) ?? [color, color];
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

export const radius = { sm: 4, md: 12, lg: 16 };

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
  /**
   * How long backgrounds keep moving after a screen opens, then they settle. Moving a full-screen
   * layer at 60 fps the whole time the app is open costs battery for little gain.
   */
  backgroundMotion: 120_000,
};
