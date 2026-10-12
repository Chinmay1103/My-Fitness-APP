import { computeBodyAge, type BodyAge, type BodyAgeFactorKey } from '@fitness/scoring';
import { useMemo } from 'react';

import { formatCount } from './format';
import { useScores } from './ScoresProvider';

/**
 * Body age for the latest 30 days (scoring's computeBodyAge) with your profile and latest
 * weigh-in, plus how each factor is named and worded. Null until 14 days of band data.
 */
export function useBodyAge(): BodyAge | null {
  const { days, scores, logged, profile } = useScores();
  return useMemo(() => {
    const workouts = days.flatMap((d) => d.workouts ?? []);
    const weighIn = logged.weights.at(-1);
    return computeBodyAge({ days, scores, workouts, profile: weighIn ? { ...profile, weightKg: weighIn.kg } : profile });
  }, [days, scores, logged.weights, profile]);
}

export const BODY_AGE_FACTORS: Record<
  BodyAgeFactorKey,
  { label: string; format: (v: number) => string; lever: (target: number) => string; why: string }
> = {
  vo2max: {
    label: 'Cardio fitness (VO2max)',
    format: (v) => `${v.toFixed(1)} ml/kg/min`,
    lever: () => 'Raise it about 3 points with 2–3 cardio sessions a week (zones 2–4)',
    why: 'The strongest single link to a long life. Estimated from your max and resting heart rate, so it’s rough.',
  },
  restingHr: {
    label: 'Resting heart rate',
    format: (v) => `${Math.round(v)} bpm`,
    lever: (t) => `Bring it to ${Math.round(t)} bpm with regular cardio and steady sleep`,
    why: 'A lower resting heart rate means a fitter, less strained heart.',
  },
  steps: {
    label: 'Daily steps',
    format: (v) => formatCount(v),
    lever: (t) => `Walk to ${formatCount(t)} a day`,
    why: 'Benefit climbs to about 8–10k a day, then levels off.',
  },
  moderate: {
    label: 'Moderate activity',
    format: (v) => `${Math.round(v)} min/week`,
    lever: (t) => `${Math.round(t)} minutes a week of brisk walking or easy cardio`,
    why: '40–60% of your heart-rate reserve: brisk walks, easy rides. 150 a week is the guideline.',
  },
  vigorous: {
    label: 'Vigorous activity',
    format: (v) => `${Math.round(v)} min/week`,
    lever: (t) => `${Math.round(t)} minutes a week of hard cardio (runs, intervals, sport)`,
    why: '60%+ of your heart-rate reserve. Counts on top of moderate activity.',
  },
  strength: {
    label: 'Strength training',
    format: (v) => `${Math.round(v)} min/week`,
    lever: (t) => `About ${Math.round(t)} minutes a week of weights`,
    why: 'From the gym sessions you told the coach about. Best around 30–60 minutes a week.',
  },
  sleepHours: {
    label: 'Hours of sleep',
    format: (v) => `${v.toFixed(1)} h`,
    lever: (t) => `Sleep about ${t.toFixed(1)} hours a night`,
    why: 'Lowest risk at 7–8 hours; both short and very long nights cost.',
  },
  sleepConsistency: {
    label: 'Bedtime consistency',
    format: (v) => `±${Math.round(v)} min`,
    lever: (t) => `Keep bedtime within ±${Math.round(t)} minutes`,
    why: 'How much your bedtime moves around (standard deviation). Regular sleep matters as much as long sleep.',
  },
  bmi: {
    label: 'Body mass index',
    format: (v) => v.toFixed(1),
    lever: (t) => `Move toward a BMI of ${t.toFixed(0)} (20–25 is the lowest-risk range)`,
    why: 'From your height and latest weigh-in.',
  },
};
