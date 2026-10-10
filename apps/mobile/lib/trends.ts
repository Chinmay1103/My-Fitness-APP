import type { DailyScores, DayData } from '@fitness/scoring';
import type { Href } from 'expo-router';
import type { SymbolViewProps } from 'expo-symbols';

import type { Palette } from '@/constants/theme';
import { formatMinutes } from './format';

/**
 * The parts that make up the sleep score, each with its own detail screen (`app/trend/[key].tsx`):
 * tap a row in "Why 83%" or a number on the Sleep tab and you get that one part over 30 days, what
 * it means and what moves it. Read straight from the score's breakdown, so it always matches.
 */

export type TrendKey = 'hoursSlept' | 'sleepNeed' | 'sleepDebt' | 'efficiency' | 'restorative' | 'consistency' | 'deep' | 'rem';

type SymbolNames = Extract<SymbolViewProps['name'], object>;

export interface TrendDef {
  key: TrendKey;
  label: string;
  unit: string;
  icon: SymbolNames;
  color: (c: Palette) => string;
  value: (s: DailyScores, d: DayData | undefined) => number | null;
  format: (v: number) => string;
  higherIsBetter: boolean;
  /** Where it's best, shown as the goal line in words. */
  target?: string;
  chart: 'bars' | 'line';
  about: string;
  affects: string;
  /** Related screens, shown as links at the bottom. */
  related: { label: string; href: Href }[];
}

const icon = (ios: SymbolNames['ios'], android: SymbolNames['android']): SymbolNames => ({ ios, android, web: android });
const pct = (v: number) => `${Math.round(v)}`;
const toSleep: { label: string; href: Href } = { label: 'Sleep score', href: '/sleep' };
const toRecovery: { label: string; href: Href } = { label: 'How sleep moved recovery', href: '/recovery' };

export const TRENDS: Record<TrendKey, TrendDef> = {
  hoursSlept: {
    key: 'hoursSlept',
    label: 'Hours slept',
    unit: '',
    icon: icon('bed.double.fill', 'bed'),
    color: (c) => c.sleep,
    value: (s) => s.sleep?.asleepMinutes ?? null,
    format: formatMinutes,
    higherIsBetter: true,
    chart: 'bars',
    about:
      'Time actually asleep (light + deep + REM), not time in bed. Divided by your sleep need, it sets the most your sleep score can be: 7 h of an 8 h need caps it at 88%.',
    affects: 'Bedtime and wake-up time most of all. Late caffeine, alcohol, a late heavy dinner and screens in bed cut into it.',
    related: [toSleep, { label: 'What you needed', href: { pathname: '/trend/[key]', params: { key: 'sleepNeed' } } }],
  },
  sleepNeed: {
    key: 'sleepNeed',
    label: 'Sleep need',
    unit: '',
    icon: icon('moon.zzz.fill', 'bedtime'),
    color: (c) => c.sleep,
    value: (s) => s.sleepNeed?.total ?? null,
    format: formatMinutes,
    higherIsBetter: false,
    chart: 'bars',
    about:
      '8 h base, plus 2.5 minutes for every strain point above 8 the day before, plus a third of what you missed over the last 3 nights (at most 60 minutes).',
    affects: 'Hard days raise it; short nights raise it until you catch up. Steady 8-hour nights bring it back to the base.',
    related: [
      { label: 'Sleep debt', href: { pathname: '/trend/[key]', params: { key: 'sleepDebt' } } },
      { label: 'Strain', href: '/strain' },
    ],
  },
  sleepDebt: {
    key: 'sleepDebt',
    label: 'Sleep debt',
    unit: 'min',
    icon: icon('hourglass', 'hourglass_bottom'),
    color: (c) => c.recovery.yellow,
    value: (s) => s.sleepNeed?.debt ?? null,
    format: (v) => `${Math.round(v)}`,
    higherIsBetter: false,
    target: '0 min',
    chart: 'bars',
    about:
      'The extra sleep added to tonight’s need to pay back recent short nights: a third of the shortfall below 8 h over the last 3 nights, at most 60 minutes.',
    affects: 'Short nights add to it. A few nights at or above your need clear it; one long lie-in only clears part.',
    related: [{ label: 'Hours slept', href: { pathname: '/trend/[key]', params: { key: 'hoursSlept' } } }, toSleep],
  },
  efficiency: {
    key: 'efficiency',
    label: 'Sleep efficiency',
    unit: '%',
    icon: icon('gauge.medium', 'speed'),
    color: (c) => c.sleep,
    value: (s) => (s.sleep ? s.sleep.efficiency * 100 : null),
    format: pct,
    higherIsBetter: true,
    target: '95% or more',
    chart: 'line',
    about:
      'Share of your time in bed that you were asleep. Full marks at 95%. Below that it takes up to 10 points off the sleep score.',
    affects: 'Lying awake before sleep or waking in the night. Caffeine after lunch, alcohol, a warm room and noise lower it.',
    related: [toSleep],
  },
  restorative: {
    key: 'restorative',
    label: 'Deep + REM',
    unit: '%',
    icon: icon('waveform.path.ecg', 'waves'),
    color: (c) => c.sleepStages.deep,
    value: (s) => (s.sleep ? s.sleep.restorativeRatio * 100 : null),
    format: pct,
    higherIsBetter: true,
    target: '40% or more',
    chart: 'line',
    about:
      'The share of sleep spent in deep and REM, the stages that repair the body and sort memories. Full marks at 40%; less takes up to 10 points off the sleep score.',
    affects: 'Alcohol cuts REM; a late meal, a hot room and a late hard workout cut deep sleep. A full night gives REM time to build up toward morning.',
    related: [
      { label: 'Deep sleep minutes', href: { pathname: '/trend/[key]', params: { key: 'deep' } } },
      { label: 'REM minutes', href: { pathname: '/trend/[key]', params: { key: 'rem' } } },
      toSleep,
    ],
  },
  consistency: {
    key: 'consistency',
    label: 'Bedtime consistency',
    unit: '%',
    icon: icon('clock.fill', 'schedule'),
    color: (c) => c.sleep,
    value: (s) => (s.sleep ? s.sleep.consistency * 100 : null),
    format: pct,
    higherIsBetter: true,
    target: '100% (same bedtime as usual)',
    chart: 'line',
    about:
      'How close bedtime was to your last 7 bedtimes. 100% is right on your usual; 2 hours off scores 0. Takes up to 10 points off the sleep score.',
    affects: 'Going to bed at the same time within about 30 minutes, weekends too.',
    related: [toSleep],
  },
  deep: {
    key: 'deep',
    label: 'Deep sleep',
    unit: '',
    icon: icon('moon.fill', 'dark_mode'),
    color: (c) => c.sleepStages.deep,
    value: (_, d) => d?.sleep?.stages.deep ?? null,
    format: formatMinutes,
    higherIsBetter: true,
    chart: 'bars',
    about: 'Minutes of deep sleep, mostly in the first half of the night. This is when the body repairs muscle and the immune system does much of its work.',
    affects: 'Hard training raises the need for it; alcohol, a late meal and a warm room cut it.',
    related: [{ label: 'Deep + REM share', href: { pathname: '/trend/[key]', params: { key: 'restorative' } } }, toRecovery],
  },
  rem: {
    key: 'rem',
    label: 'REM sleep',
    unit: '',
    icon: icon('sparkles', 'auto_awesome'),
    color: (c) => c.sleepStages.rem,
    value: (_, d) => d?.sleep?.stages.rem ?? null,
    format: formatMinutes,
    higherIsBetter: true,
    chart: 'bars',
    about: 'Minutes of REM sleep, mostly in the last hours before waking. It matters for memory, learning and mood.',
    affects: 'Cutting the night short cuts REM first. Alcohol suppresses it.',
    related: [{ label: 'Deep + REM share', href: { pathname: '/trend/[key]', params: { key: 'restorative' } } }, toSleep],
  },
};

export function trendHref(key: TrendKey): Href {
  return { pathname: '/trend/[key]', params: { key } };
}
