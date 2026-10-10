import type { Dataset, Day } from './data';
import { dateRange } from './dates';
import { formatClock, formatMinutes, formatNumber } from './format';

/** Every number the website can chart, per day. Display only: none of this changes a score. */

export type MetricKey =
  | 'recovery'
  | 'strain'
  | 'sleepScore'
  | 'asleep'
  | 'hrv'
  | 'restingHr'
  | 'bedtime'
  | 'steps'
  | 'zoneMinutes'
  | 'energy'
  | 'spo2'
  | 'breathing'
  | 'skinTemp'
  | 'hrAvg'
  | 'caloriesIn'
  | 'protein'
  | 'weight';

export interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  /** CSS color variable. */
  color: string;
  format: (v: number) => string;
  /** Which direction is good, for coloring changes. null = neither. */
  better: 'up' | 'down' | null;
  /** Logged only on some days: draw the line across the gaps. */
  sparse?: boolean;
  /** Where the y axis starts, when zero isn't meaningful. */
  zeroBased: boolean;
  /** Fixed axis range, for scores. */
  domain?: [number, number];
  /** One sentence on what it is. */
  about: string;
}

const n0 = (v: number) => formatNumber(v);
const n1 = (v: number) => formatNumber(v, 1);

export const METRICS: Record<MetricKey, MetricDef> = {
  recovery: { key: 'recovery', label: 'Recovery', unit: '%', color: 'var(--recovery)', format: (v) => `${n0(v)}%`, better: 'up', zeroBased: true, domain: [0, 100], about: 'HRV and resting heart rate against your own 30-day normal, plus sleep.' },
  strain: { key: 'strain', label: 'Strain', unit: '0–21', color: 'var(--strain)', format: n1, better: null, zeroBased: true, domain: [0, 21], about: 'How hard your heart worked over the day, on a 0–21 scale.' },
  sleepScore: { key: 'sleepScore', label: 'Sleep score', unit: '%', color: 'var(--sleep)', format: (v) => `${n0(v)}%`, better: 'up', zeroBased: true, domain: [0, 100], about: 'Hours slept against your need, minus points for poor quality.' },
  asleep: { key: 'asleep', label: 'Time asleep', unit: 'h', color: 'var(--sleep)', format: (v) => formatMinutes(v * 60), better: 'up', zeroBased: true, about: 'Light, deep and REM sleep added up.' },
  hrv: { key: 'hrv', label: 'HRV', unit: 'ms', color: 'var(--hrv)', format: (v) => `${n0(v)} ms`, better: 'up', zeroBased: false, about: 'Heart rate variability during sleep (RMSSD). Higher usually means better recovered.' },
  restingHr: { key: 'restingHr', label: 'Resting heart rate', unit: 'bpm', color: 'var(--resting-hr)', format: (v) => `${n0(v)} bpm`, better: 'down', zeroBased: false, about: 'Your lowest steady heart rate overnight. Lower usually means better recovered.' },
  bedtime: { key: 'bedtime', label: 'Bedtime', unit: 'time', color: 'var(--sleep)', format: formatClock, better: null, zeroBased: false, about: 'When the main sleep started.' },
  steps: { key: 'steps', label: 'Steps', unit: 'steps', color: 'var(--steps)', format: n0, better: 'up', zeroBased: true, about: 'Band and phone steps combined, with ghost steps (scooter rides) dropped.' },
  zoneMinutes: { key: 'zoneMinutes', label: 'Active Zone Minutes', unit: 'min', color: 'var(--strain)', format: (v) => `${n0(v)} min`, better: 'up', zeroBased: true, about: '1 per minute in fat burn, 2 per minute in cardio or peak. 150 a week is the goal.' },
  energy: { key: 'energy', label: 'Energy burned', unit: 'kcal', color: 'var(--calories)', format: (v) => `${n0(v)} kcal`, better: null, zeroBased: false, about: "The whole day's energy use, as the band's app estimates it." },
  spo2: { key: 'spo2', label: 'Blood oxygen', unit: '%', color: 'var(--spo2)', format: (v) => `${n1(v)}%`, better: null, zeroBased: false, about: 'Average SpO₂ during sleep.' },
  breathing: { key: 'breathing', label: 'Breathing rate', unit: 'br/min', color: 'var(--sleep)', format: (v) => `${n1(v)} br/min`, better: null, zeroBased: false, about: 'Breaths per minute asleep. A jump can be an early sign of illness.' },
  skinTemp: { key: 'skinTemp', label: 'Skin temperature', unit: '°C', color: 'var(--calories)', format: (v) => `${v > 0 ? '+' : ''}${n1(v)} °C`, better: null, zeroBased: false, about: "Last night's skin temperature against the band's own baseline." },
  hrAvg: { key: 'hrAvg', label: 'Average heart rate', unit: 'bpm', color: 'var(--resting-hr)', format: (v) => `${n0(v)} bpm`, better: null, zeroBased: false, about: 'Average heart rate across the day.' },
  caloriesIn: { key: 'caloriesIn', label: 'Calories eaten', unit: 'kcal', color: 'var(--calories)', format: (v) => `${n0(v)} kcal`, better: null, zeroBased: true, about: 'Meals you told the coach about, added up. Days without a logged meal are left out.' },
  protein: { key: 'protein', label: 'Protein', unit: 'g', color: 'var(--recovery)', format: (v) => `${n0(v)} g`, better: 'up', zeroBased: true, about: 'Protein from logged meals.' },
  weight: { key: 'weight', label: 'Weight', unit: 'kg', color: 'var(--weight)', format: (v) => `${n1(v)} kg`, better: null, sparse: true, zeroBased: false, about: 'Weigh-ins you told the coach about.' },
};

export const METRIC_ORDER: MetricKey[] = [
  'recovery', 'strain', 'sleepScore', 'asleep', 'hrv', 'restingHr', 'bedtime', 'steps', 'zoneMinutes',
  'energy', 'spo2', 'breathing', 'skinTemp', 'hrAvg', 'caloriesIn', 'protein', 'weight',
];

export function dayValue(day: Day, key: MetricKey): number | null {
  switch (key) {
    case 'recovery': return day.recovery;
    case 'strain': return day.strain;
    case 'sleepScore': return day.sleepScore;
    case 'asleep': return day.asleep == null ? null : day.asleep / 60;
    case 'hrv': return day.hrv;
    case 'restingHr': return day.restingHr;
    case 'bedtime': return day.bedtime;
    case 'steps': return day.steps;
    case 'zoneMinutes': return day.zoneMinutes;
    case 'energy': return day.energy;
    case 'spo2': return day.spo2;
    case 'breathing': return day.breathing;
    case 'skinTemp': return day.skinTemp;
    case 'hrAvg': return day.hrAvg;
    default: return null;
  }
}

/** One calendar day in the picked range, with or without synced data. */
export interface Row {
  date: string;
  day: Day | null;
  values: Record<MetricKey, number | null>;
  workouts: number;
}

/** Every date from `from` to `to`, lined up with the data, gaps included (so charts show them). */
export function buildRows(data: Dataset, from: string, to: string): Row[] {
  const days = new Map(data.days.map((d) => [d.date, d]));
  const food = new Map<string, { calories: number | null; protein: number | null }>();
  for (const m of data.meals) {
    const f = food.get(m.date) ?? { calories: null, protein: null };
    if (m.calories != null) f.calories = (f.calories ?? 0) + m.calories;
    if (m.proteinG != null) f.protein = (f.protein ?? 0) + m.proteinG;
    food.set(m.date, f);
  }
  const weights = new Map<string, number>();
  for (const w of data.weights) weights.set(w.date, w.kg); // the day's last weigh-in wins
  const workouts = new Map<string, number>();
  for (const w of data.workouts) workouts.set(w.date, (workouts.get(w.date) ?? 0) + 1);

  return dateRange(from, to).map((date) => {
    const day = days.get(date) ?? null;
    const values = {} as Record<MetricKey, number | null>;
    for (const key of METRIC_ORDER) values[key] = day ? dayValue(day, key) : null;
    values.caloriesIn = food.get(date)?.calories ?? null;
    values.protein = food.get(date)?.protein ?? null;
    values.weight = weights.get(date) ?? null;
    return { date, day, values, workouts: workouts.get(date) ?? 0 };
  });
}
