import type { DailyScores, RecoveryFactor, RecoveryZone } from '@fitness/scoring';

/**
 * Plain-language explanations of the scores. Rule-based for now; the AI coach (milestone 4)
 * will go further, but these are always available and always match the math exactly.
 */

export const FACTOR_LABELS: Record<RecoveryFactor['key'], string> = {
  hrv: 'Heart rate variability',
  restingHr: 'Resting heart rate',
  respiratoryRate: 'Breathing rate',
  sleep: 'Sleep performance',
};

export function recoveryFactorDetail(f: RecoveryFactor): string {
  const diff = f.today - f.baseline;
  switch (f.key) {
    case 'hrv': {
      const pct = Math.round((diff / f.baseline) * 100);
      const vs = pct === 0 ? 'right at' : `${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'}`;
      return `${f.today} ms, ${vs} your usual ${f.baseline} ms. Higher means your nervous system is more relaxed.`;
    }
    case 'restingHr': {
      const vs = diff === 0 ? 'the same as' : `${Math.abs(diff)} bpm ${diff < 0 ? 'lower than' : 'higher than'}`;
      return `${f.today} bpm, ${vs} your usual ${f.baseline} bpm. Lower means your heart is working less to recover.`;
    }
    case 'respiratoryRate': {
      const d = Math.round(diff * 10) / 10;
      const vs = d === 0 ? 'the same as' : `${Math.abs(d)} ${d < 0 ? 'slower than' : 'faster than'}`;
      return `${f.today} breaths a minute asleep, ${vs} your usual ${f.baseline}. Faster breathing can be an early sign of illness or overtraining.`;
    }
    case 'sleep':
      return `${f.today}% last night vs an ${f.baseline}% benchmark.`;
  }
}

export const RECOVERY_GUIDANCE: Record<RecoveryZone, { title: string; body: string }> = {
  green: {
    title: 'Ready to perform',
    body: 'Your body has bounced back well. A good day for a hard workout or pushing intensity.',
  },
  yellow: {
    title: 'Maintaining',
    body: 'You are partly recovered. Train as planned but keep the hardest efforts moderate, and protect tonight’s sleep.',
  },
  red: {
    title: 'Take it easy',
    body: 'Your body is still under stress (training, poor sleep, illness, alcohol or life stress can all do this). Favour rest, a walk or mobility work, and an early night.',
  },
};

/** One sentence for the Today screen: what mattered most this morning. */
export function todayHeadline(day: DailyScores): string | null {
  const b = day.recovery?.breakdown;
  if (!b || day.recovery?.zone == null) return null;
  const top = [...b.factors].sort((a, c) => Math.abs(c.points) - Math.abs(a.points))[0];
  const lead = RECOVERY_GUIDANCE[day.recovery.zone].title;
  if (!top || top.points === 0) return `${lead}. Everything is close to your usual.`;
  const direction = top.points > 0 ? 'lifted' : 'pulled down';
  const what: Record<RecoveryFactor['key'], string> = {
    hrv: top.today > top.baseline ? 'Higher-than-usual HRV' : 'Lower-than-usual HRV',
    restingHr: top.today < top.baseline ? 'A lower resting heart rate' : 'A higher resting heart rate',
    respiratoryRate: top.today <= top.baseline ? 'Calm breathing' : 'Faster-than-usual breathing',
    sleep: top.today >= top.baseline ? 'Good sleep' : 'Short or restless sleep',
  };
  return `${lead}. ${what[top.key]} ${direction} your recovery the most.`;
}
