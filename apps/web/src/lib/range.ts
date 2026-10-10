import { addDays } from './dates';

export type Preset = '30d' | '90d' | '6m' | '1y' | 'all' | 'custom';

export interface DateRange {
  preset: Preset;
  from: string;
  to: string;
}

export const PRESETS: { value: Preset; label: string }[] = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
];

/** The dates a preset covers, ending today. `first` is the earliest day with data (for "All time"). */
export function presetRange(preset: Exclude<Preset, 'custom'>, today: string, first: string): DateRange {
  const back = { '30d': 29, '90d': 89, '6m': 182, '1y': 364 } as const;
  const from = preset === 'all' ? (first < today ? first : addDays(today, -29)) : addDays(today, -back[preset]);
  return { preset, from, to: today };
}

const KEY = 'myfitness.range';

export function loadPreset(): Preset {
  try {
    const v = localStorage.getItem(KEY);
    return v && PRESETS.some((p) => p.value === v) && v !== 'custom' ? (v as Preset) : '90d';
  } catch {
    return '90d';
  }
}

export function savePreset(p: Preset) {
  try {
    localStorage.setItem(KEY, p);
  } catch {
    // Private window or blocked storage: the range just isn't remembered.
  }
}
