import {
  activeZoneMinutes,
  combineSteps,
  trainingLoad,
  type LoadDay,
  daySamples,
  summarizeHeartRate,
  weeklyZoneProgress,
  type DailyScores,
  type DayData,
  type HeartRateSummary,
  type StepTotals,
  type UserProfile,
  type ZoneMinutes,
} from '@fitness/scoring';
import type { SymbolViewProps } from 'expo-symbols';

import type { Palette } from '@/constants/theme';
import { formatCount } from './format';
import { dayNutrition, type Logged, type LoggedMeal } from './logged';

/**
 * Everything the Today dashboard shows besides the three scores, per day, and how each metric is
 * labelled, colored and explained. Display only: none of this changes a score.
 */

export interface DayMetrics {
  date: string;
  steps: StepTotals | null;
  heartRate: HeartRateSummary | null;
  restingHr: number | null;
  hrv: number | null;
  spo2: number | null;
  breathing: number | null;
  zones: ZoneMinutes | null;
  /** Active Zone Minutes over the 7 days ending this day, and the share of the 150-minute goal. */
  weekly: { minutes: number; progress: number };
  energy: number | null;
  nutrition: { calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null; meals: LoggedMeal[] };
  /** Latest weigh-in on or before this day. */
  weightKg: number | null;
  /** Last night's skin temperature vs the band's baseline, °C. */
  skinTemp: number | null;
  /** Last 7 days' load against the last 28. */
  load: LoadDay | null;
}

const FALLBACK_RESTING_HR = 60;

export function computeDayMetrics(days: DayData[], scores: DailyScores[], logged: Logged, profile: UserProfile): DayMetrics[] {
  const zoneTotals: number[] = [];
  const loads = trainingLoad(scores);
  return days.map((day, i) => {
    const recent = days.slice(Math.max(0, i - 7), i + 1).flatMap((d) => (d.restingHr ? [d.restingHr] : []));
    const restingHr = day.restingHr ?? (recent.length ? normalRange(recent).mid : FALLBACK_RESTING_HR);
    const zones = day.heartRate.length ? activeZoneMinutes(day.heartRate, restingHr, profile) : null;
    zoneTotals.push(zones?.total ?? 0);
    const endOfDay = new Date(`${day.date}T23:59:59`).getTime();
    const weighIn = logged.weights.filter((w) => w.measuredAt <= endOfDay).at(-1);
    const nutrition = dayNutrition(logged.meals, day.date);
    return {
      date: day.date,
      steps: day.steps?.length ? combineSteps(day.steps, daySamples(day), restingHr) : null,
      heartRate: summarizeHeartRate(daySamples(day)),
      restingHr: day.restingHr ?? null,
      hrv: day.hrvRmssd ?? null,
      spo2: day.spo2 ?? null,
      breathing: day.respiratoryRate ?? null,
      zones,
      weekly: weeklyZoneProgress(zoneTotals),
      energy: day.caloriesBurned ?? null,
      nutrition,
      weightKg: weighIn ? weighIn.kg : null,
      skinTemp: day.skinTempDelta ?? null,
      load: loads[i] ?? null,
    };
  });
}

type SymbolNames = Extract<SymbolViewProps['name'], object>;

export type MetricKey =
  | 'steps'
  | 'heartRate'
  | 'restingHr'
  | 'hrv'
  | 'spo2'
  | 'breathing'
  | 'zoneMinutes'
  | 'weeklyCardio'
  | 'energy'
  | 'caloriesIn'
  | 'macros'
  | 'weight'
  | 'skinTemp'
  | 'trainingLoad';

export interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  icon: SymbolNames;
  color: (c: Palette) => string;
  value: (m: DayMetrics) => number | null;
  format: (v: number) => string;
  /** Which direction is good; null when neither is (weight, energy burned). */
  higherIsBetter: boolean | null;
  /** A daily target, when the metric has one (steps, zone minutes). */
  goal?: number;
  /** Bars for daily counts, a line with your normal range for body signals. */
  chart: 'bars' | 'line';
  about: string;
  affects: string;
}

const icon = (ios: SymbolNames['ios'], android: SymbolNames['android']): SymbolNames => ({ ios, android, web: android });

export const STEP_GOAL = 8000;
/** 150 minutes a week, spread over 7 days, as Fitbit shows it. */
export const DAILY_ZONE_GOAL = 22;

export const METRICS: Record<MetricKey, MetricDef> = {
  steps: {
    key: 'steps',
    label: 'Steps',
    unit: 'steps',
    icon: icon('figure.walk', 'directions_walk'),
    color: (c) => c.steps,
    value: (m) => m.steps?.total ?? null,
    format: formatCount,
    higherIsBetter: true,
    goal: STEP_GOAL,
    chart: 'bars',
    about:
      'Band and phone together. The band counts every step but also arm movement (a scooter ride, waving your hands as you talk); the phone only counts while you carry it. Each 5 minutes is checked: band steps with no walking on the phone and a flat heart rate are dropped as ghost steps.',
    affects: 'Walking, stairs and errands. Workouts on a bike or in the gym add strain but few steps.',
  },
  heartRate: {
    key: 'heartRate',
    label: 'Heart rate',
    unit: 'bpm avg',
    icon: icon('heart.fill', 'favorite'),
    color: (c) => c.restingHr,
    value: (m) => (m.heartRate ? Math.round(m.heartRate.avg) : null),
    format: (v) => String(Math.round(v)),
    higherIsBetter: null,
    chart: 'line',
    about: 'Your average over the minutes the band saw that day, night included. The full day, zone by zone, is one tap away.',
    affects: 'Activity, stress, caffeine, heat, illness and how well you slept.',
  },
  restingHr: {
    key: 'restingHr',
    label: 'Resting heart rate',
    unit: 'bpm',
    icon: icon('heart.text.square', 'monitor_heart'),
    color: (c) => c.restingHr,
    value: (m) => m.restingHr,
    format: (v) => String(Math.round(v)),
    higherIsBetter: false,
    chart: 'line',
    about: 'Your lowest steady heart rate, measured overnight. A quarter of your recovery score: lower than your usual means your heart is working less to recover.',
    affects: 'Hard training the day before, alcohol, late meals, dehydration, illness and stress raise it; fitness lowers it over weeks.',
  },
  hrv: {
    key: 'hrv',
    label: 'Heart rate variability',
    unit: 'ms',
    icon: icon('waveform.path.ecg', 'monitor_heart'),
    color: (c) => c.hrv,
    value: (m) => m.hrv,
    format: (v) => String(Math.round(v)),
    higherIsBetter: true,
    chart: 'line',
    about: 'The tiny variation between heartbeats overnight (RMSSD). The biggest part of your recovery score: higher than your usual means your nervous system is relaxed and ready.',
    affects: 'Sleep, alcohol, hard training, illness and stress pull it down; it is personal, so only compare with your own normal.',
  },
  spo2: {
    key: 'spo2',
    label: 'Blood oxygen',
    unit: '%',
    icon: icon('lungs.fill', 'air'),
    color: (c) => c.spo2,
    value: (m) => m.spo2,
    format: (v) => `${Math.round(v)}`,
    higherIsBetter: true,
    chart: 'line',
    about: 'Average SpO2 while you slept. 95–100% is typical at sea level. Shown only; it doesn’t change a score.',
    affects: 'Altitude, congestion, illness and some sleep-breathing problems lower it. A wellness reading, not a medical one.',
  },
  breathing: {
    key: 'breathing',
    label: 'Breathing rate',
    unit: 'br/min',
    icon: icon('wind', 'air'),
    color: (c) => c.sleep,
    value: (m) => m.breathing,
    format: (v) => v.toFixed(1),
    higherIsBetter: false,
    chart: 'line',
    about: 'Breaths per minute while asleep. Very stable from night to night, so a jump above your usual is one of the earliest signs of illness or overreaching. Counts toward recovery once there are 4 nights to compare with.',
    affects: 'Illness, hard training, alcohol and heat.',
  },
  zoneMinutes: {
    key: 'zoneMinutes',
    label: 'Active Zone Minutes',
    unit: 'min',
    icon: icon('flame.fill', 'local_fire_department'),
    color: (c) => c.strain,
    value: (m) => m.zones?.total ?? null,
    format: (v) => String(Math.round(v)),
    higherIsBetter: true,
    goal: DAILY_ZONE_GOAL,
    chart: 'bars',
    about: 'Minutes your heart rate was up, counted the way Fitbit does: 1 per minute in fat burn, 2 per minute in cardio or peak. 150 a week is the health guideline.',
    affects: 'Brisk walks, runs, rides, sports and hard gym work.',
  },
  weeklyCardio: {
    key: 'weeklyCardio',
    label: 'Weekly cardio',
    unit: '% of goal',
    icon: icon('chart.line.uptrend.xyaxis', 'trending_up'),
    color: (c) => c.strain,
    value: (m) => Math.round(m.weekly.progress * 100),
    format: (v) => `${Math.round(v)}`,
    higherIsBetter: true,
    goal: 100,
    chart: 'bars',
    about: 'Active Zone Minutes over the last 7 days against the 150-minute weekly goal.',
    affects: 'Spreading activity through the week counts as much as one big day.',
  },
  energy: {
    key: 'energy',
    label: 'Energy burned',
    unit: 'kcal',
    icon: icon('bolt.fill', 'bolt'),
    color: (c) => c.calories,
    value: (m) => m.energy,
    format: formatCount,
    higherIsBetter: null,
    chart: 'bars',
    about: 'Everything you burned that day, resting metabolism included, as Google Health estimates it from the band.',
    affects: 'Body size, activity and workouts. Compared with what you ate when you log meals.',
  },
  caloriesIn: {
    key: 'caloriesIn',
    label: 'Calories eaten',
    unit: 'kcal',
    icon: icon('fork.knife', 'restaurant'),
    color: (c) => c.calories,
    value: (m) => m.nutrition.calories,
    format: formatCount,
    higherIsBetter: null,
    chart: 'bars',
    about: 'From the meals you told the coach about. Claude estimates the calories and macros, so treat them as a good guess.',
    affects: 'Tell the coach what you ate (typing or voice) and it shows up here.',
  },
  macros: {
    key: 'macros',
    label: 'Protein',
    unit: 'g',
    icon: icon('takeoutbag.and.cup.and.straw', 'egg_alt'),
    color: (c) => c.recovery.green,
    value: (m) => m.nutrition.proteinG,
    format: (v) => String(Math.round(v)),
    higherIsBetter: true,
    chart: 'bars',
    about: 'Protein, carbs and fat from the meals you logged. Around 1.6 g of protein per kg of body weight a day supports training and recovery.',
    affects: 'What you eat; log meals in the coach chat.',
  },
  weight: {
    key: 'weight',
    label: 'Weight',
    unit: 'kg',
    icon: icon('scalemass.fill', 'monitor_weight'),
    color: (c) => c.weight,
    value: (m) => m.weightKg,
    format: (v) => v.toFixed(1),
    higherIsBetter: null,
    chart: 'line',
    about: 'Your latest weigh-in, told to the coach. Day-to-day changes are mostly water; look at the trend over weeks.',
    affects: 'Food, salt, carbs, hydration and training.',
  },
  skinTemp: {
    key: 'skinTemp',
    label: 'Skin temperature',
    unit: '°C vs usual',
    icon: icon('thermometer.medium', 'device_thermostat'),
    color: (c) => c.calories,
    value: (m) => m.skinTemp,
    format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`,
    higherIsBetter: false,
    chart: 'line',
    about:
      'How much warmer or cooler your skin was overnight than the band’s own baseline. Small night-to-night changes are normal; a rise of half a degree or more, together with faster breathing or a higher resting heart rate, is what the Body check watches for.',
    affects: 'Illness coming on, alcohol, a hot room or heavy bedding, late hard training, and the menstrual cycle.',
  },

  trainingLoad: {
    key: 'trainingLoad',
    label: 'Training load',
    unit: 'last 7 vs 28 days',
    icon: icon('chart.bar.xaxis', 'stacked_bar_chart'),
    color: (c) => c.strain,
    value: (m) => m.load?.ratio ?? null,
    format: (v) => v.toFixed(2),
    higherIsBetter: null,
    chart: 'line',
    about:
      'Your average daily load over the last 7 days divided by the last 28. Around 1 means you’re training like you usually do; 0.8–1.3 builds fitness steadily; above 1.5 is a jump big enough to raise the risk of illness and injury; below 0.8 you’re resting or losing fitness.',
    affects: 'Every workout and active day. Build up by no more than about 10–30% a week.',
  },
};

export const DASHBOARD_ORDER: MetricKey[] = [
  'steps',
  'heartRate',
  'restingHr',
  'hrv',
  'spo2',
  'breathing',
  'zoneMinutes',
  'weeklyCardio',
  'energy',
  'caloriesIn',
  'macros',
  'weight',
  'trainingLoad',
  'skinTemp',
];

export type MetricStatus = { label: string; tone: 'good' | 'bad' | 'neutral' };

/**
 * How a day's value compares with your own normal (the middle half of the last 30 days), or with
 * the goal for metrics that have one. Null when there's too little to compare with.
 */
export function metricStatus(def: MetricDef, series: (number | null)[], index: number): MetricStatus | null {
  const v = series[index];
  if (v == null) return null;
  if (def.goal) {
    if (v >= def.goal) return { label: 'Goal reached', tone: 'good' };
    const left = def.goal - v;
    return { label: `${def.format(left)} to go`, tone: 'neutral' };
  }
  const history = series.slice(Math.max(0, index - 30), index).filter((x): x is number => x != null);
  if (history.length < 5) return null;
  const range = normalRange(history);
  if (v >= range.low && v <= range.high) return { label: 'In range', tone: 'neutral' };
  const above = v > range.high;
  const tone = def.higherIsBetter == null ? 'neutral' : above === def.higherIsBetter ? 'good' : 'bad';
  return { label: above ? 'Above usual' : 'Below usual', tone };
}

/** The middle half of your values: what "usual" means on every metric screen. */
export function normalRange(values: number[]): { low: number; mid: number; high: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
  return { low: q(0.25), mid: q(0.5), high: q(0.75) };
}
