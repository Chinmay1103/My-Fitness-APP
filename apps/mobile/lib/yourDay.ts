import { MIN_BASELINE_DAYS, type DailyScores, type DayData, type RecoveryFactor, type UserProfile } from '@fitness/scoring';
import type { Href } from 'expo-router';

import { formatMinutes, formatTime } from './format';
import { STRAIN_TARGETS, tonightPlan } from './nextSteps';
import { steadyMinutesTo } from './why';

/**
 * "Your day" in three plain lines, so the app can be read without reading every number: how your
 * body is, the one thing to do today, and tonight. Rule-based on the same numbers as the scores;
 * nothing here changes a score.
 */

export type Tone = 'good' | 'okay' | 'watch' | 'neutral';

export interface DayLine {
  /** BODY, TODAY, TONIGHT. */
  label: string;
  /** A word or two you can take in at a glance: "Partly recovered". */
  verdict: string;
  text: string;
  tone: Tone;
  href: Href;
}

/** What each recovery zone means for the day's training, in words. */
export const TARGET_WORDS = {
  green: 'a hard workout is fine',
  yellow: 'a moderate workout',
  red: 'rest, a walk or stretching',
} as const;

const HELPED: Record<RecoveryFactor['key'], [better: string, worse: string]> = {
  hrv: ['HRV above your usual', 'HRV below your usual'],
  restingHr: ['a lower resting heart rate than usual', 'a higher resting heart rate than usual'],
  respiratoryRate: ['calm breathing', 'faster breathing than usual'],
  sleep: ['a good night', 'a short or restless night'],
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function bodyLine(score: DailyScores): DayLine {
  const r = score.recovery;
  if (!r || r.score == null || !r.zone || !r.breakdown) {
    return {
      label: 'BODY',
      verdict: 'Learning your normal',
      text: `Recovery needs ${MIN_BASELINE_DAYS} nights of HRV and resting heart rate (${r?.daysOfHistory ?? 0} so far). Until then, go by how you feel.`,
      tone: 'neutral',
      href: '/recovery',
    };
  }
  const verdict = r.zone === 'green' ? 'Well recovered' : r.zone === 'yellow' ? 'Partly recovered' : 'Not recovered';
  const sorted = [...r.breakdown.factors].sort((a, b) => b.points - a.points);
  const plus = sorted[0] && sorted[0].points >= 3 ? sorted[0] : null;
  const minus = sorted.at(-1) && sorted.at(-1)!.points <= -3 ? sorted.at(-1)! : null;
  const parts: string[] = [];
  if (plus) parts.push(`${HELPED[plus.key][0]} helped`);
  if (minus) parts.push(`${HELPED[minus.key][1]} held it back`);
  const why = parts.length ? `${capitalize(parts.join('; '))}.` : 'Everything was close to your usual.';
  return {
    label: 'BODY',
    verdict: `${verdict} · ${r.score}%`,
    text: why,
    tone: r.zone === 'green' ? 'good' : r.zone === 'yellow' ? 'okay' : 'watch',
    href: '/recovery',
  };
}

function todayLine(score: DailyScores, isLatest: boolean): DayLine {
  const { strain, trimp } = score.strain;
  const zone = score.recovery?.zone;
  if (!zone) {
    return {
      label: isLatest ? 'TODAY' : 'THAT DAY',
      verdict: `Strain ${strain.toFixed(1)}`,
      text: 'No target until recovery has a score. A normal day of training is fine.',
      tone: 'neutral',
      href: '/strain',
    };
  }
  const [lo, hi] = STRAIN_TARGETS[zone];
  const aim = `Aim for strain ${lo}–${hi}: ${TARGET_WORDS[zone]}.`;
  if (!isLatest) {
    const verdict = strain < lo ? 'Under target' : strain <= hi ? 'On target' : 'Over target';
    return {
      label: 'THAT DAY',
      verdict,
      text: `Target was ${lo}–${hi} (${TARGET_WORDS[zone]}); strain ended at ${strain.toFixed(1)}.`,
      tone: strain > hi && zone !== 'green' ? 'watch' : strain >= lo && strain <= hi ? 'good' : 'neutral',
      href: '/strain',
    };
  }
  if (strain < lo) {
    return {
      label: 'TODAY',
      verdict: `${strain.toFixed(1)} of ${lo}–${hi}`,
      text: `${aim} About ${formatMinutes(steadyMinutesTo(lo, trimp))} of steady cardio (zone 2–3) would get you there.`,
      tone: 'neutral',
      href: '/strain',
    };
  }
  if (strain <= hi) {
    return { label: 'TODAY', verdict: 'Target reached', text: `${aim} You're there; anything more is optional.`, tone: 'good', href: '/strain' };
  }
  return {
    label: 'TODAY',
    verdict: 'Over target',
    text: zone === 'green' ? `${aim} You've gone past it: good training, now make sure you sleep enough.` : `${aim} You're past it: keep the rest of the day easy and sleep early.`,
    tone: zone === 'green' ? 'good' : 'watch',
    href: '/strain',
  };
}

function tonightLine(scores: DailyScores[], days: DayData[], profile: UserProfile, now: number): DayLine | null {
  const plan = tonightPlan(scores, days, profile, now);
  if (!plan) return null;
  const extras = [plan.need.strain >= 5 ? `+${formatMinutes(plan.need.strain)} for today's strain` : '', plan.need.debt >= 5 ? `+${formatMinutes(plan.need.debt)} to pay back short nights` : '']
    .filter(Boolean)
    .join(', ');
  return {
    label: 'TONIGHT',
    verdict: `In bed by ${formatTime(plan.bedAt)}`,
    text: `You need ${formatMinutes(plan.need.total)} of sleep${extras ? ` (${extras})` : ''} before your usual ${formatTime(plan.wakeAt)} wake-up.`,
    tone: 'neutral',
    href: '/sleep',
  };
}

function nightLine(score: DailyScores): DayLine | null {
  if (!score.sleep) return null;
  const { asleepMinutes, needMinutes, score: pct } = score.sleep;
  const short = needMinutes - asleepMinutes;
  return {
    label: 'THE NIGHT BEFORE',
    verdict: `Sleep ${pct}%`,
    text: `Slept ${formatMinutes(asleepMinutes)} of the ${formatMinutes(needMinutes)} needed${short > 30 ? `: ${formatMinutes(short)} short` : ''}.`,
    tone: pct >= 85 ? 'good' : pct >= 70 ? 'okay' : 'watch',
    href: '/sleep',
  };
}

export function yourDay(
  { scores, days, profile }: { scores: DailyScores[]; days: DayData[]; profile: UserProfile },
  index: number,
  isLatest: boolean,
  now = Date.now(),
): DayLine[] {
  const score = scores[index];
  if (!score) return [];
  const third = isLatest ? tonightLine(scores, days, profile, now) : nightLine(score);
  return [bodyLine(score), todayLine(score, isLatest), ...(third ? [third] : [])];
}
