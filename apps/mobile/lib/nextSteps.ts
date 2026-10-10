import { sleepNeed, type DailyScores, type DayData, type UserProfile } from '@fitness/scoring';
import type { Href } from 'expo-router';

import { formatCount, formatMinutes, formatTime } from './format';
import { DAILY_ZONE_GOAL, normalRange, STEP_GOAL, type DayMetrics } from './metrics';

/**
 * "What to do next" for the Today screen: a few concrete suggestions worked out from the scores
 * and metrics with simple rules, so they always agree with the numbers. The coach note (Claude)
 * goes further; these are always there, even offline.
 */

export type NextStepKind = 'train' | 'sleep' | 'steps' | 'cardio' | 'breathing' | 'protein' | 'log';

export interface NextStep {
  kind: NextStepKind;
  title: string;
  detail: string;
  /** Where tapping it goes. */
  href: Href;
  /** Lower comes first. */
  priority: number;
}

/** Whoop-style strain targets per recovery zone: how hard today can be. */
export const STRAIN_TARGETS = { green: [14, 18], yellow: [10, 14], red: [0, 10] } as const;
const SLEEP_LATENCY_MIN = 15;
const PROTEIN_G_PER_KG = 1.6;
const DAY = 86_400_000;

interface Input {
  scores: DailyScores[];
  days: DayData[];
  metrics: DayMetrics[];
  profile: UserProfile;
  now?: number;
}

export function nextSteps({ scores, days, metrics, profile, now = Date.now() }: Input): NextStep[] {
  const today = scores.at(-1);
  const m = metrics.at(-1);
  if (!today || !m) return [];
  const steps: NextStep[] = [];
  const hour = new Date(now).getHours();

  // Breathing well above your usual: the earliest warning sign there is, so it goes first.
  const breathingHistory = metrics.slice(-31, -1).flatMap((d) => (d.breathing != null ? [d.breathing] : []));
  if (m.breathing != null && breathingHistory.length >= 5) {
    const usual = normalRange(breathingHistory).mid;
    if (m.breathing - usual >= 1) {
      steps.push({
        kind: 'breathing',
        title: 'Take it easy today',
        detail: `Breathing was ${(m.breathing - usual).toFixed(1)} breaths/min above your usual last night, an early sign of illness or overreaching. Keep training light and get to bed early.`,
        href: '/metric/breathing',
        priority: 0,
      });
    }
  }

  // How hard to go today, from recovery.
  const zone = today.recovery?.zone;
  if (zone) {
    const [lo, hi] = STRAIN_TARGETS[zone];
    const strain = today.strain.strain;
    const done = strain >= lo && zone !== 'red';
    const over = zone === 'red' && strain >= hi;
    steps.push({
      kind: 'train',
      title:
        zone === 'green'
          ? `Push today: aim for strain ${lo}–${hi}`
          : zone === 'yellow'
            ? `Train moderately: strain ${lo}–${hi}`
            : `Recovery day: keep strain under ${hi}`,
      detail: over
        ? `You're at ${strain.toFixed(1)} already. Rest from here: a slow walk or stretching at most.`
        : done
          ? `You're at ${strain.toFixed(1)}: in the target. Anything more is a bonus, not a must.`
          : zone === 'red'
            ? `You're at ${strain.toFixed(1)}. A walk, yoga or mobility work helps you bounce back without adding load.`
            : `You're at ${strain.toFixed(1)}. ${zone === 'green' ? 'A hard session or intervals fit well today.' : 'A steady session; keep the hardest efforts short.'}`,
      href: '/strain',
      priority: zone === 'red' ? 1 : 2,
    });
  }

  // Bedtime tonight: tonight's need from today's strain and recent nights, back from your usual wake-up.
  const base = profile.baseSleepNeedMinutes ?? 480;
  const recentShortfalls = scores.slice(-3).flatMap((s) => (s.sleep ? [base - s.sleep.asleepMinutes] : []));
  const need = sleepNeed({ baseNeedMinutes: base, priorDayStrain: today.strain.strain, recentShortfalls });
  const wakeTimes = days.slice(-7).flatMap((d) => (d.sleep ? [minutesOfDay(d.sleep.end)] : []));
  if (wakeTimes.length >= 3 && hour >= 12) {
    const wake = normalRange(wakeTimes).mid;
    const wakeAt = startOfDay(now) + DAY + wake * 60_000;
    const bedAt = wakeAt - (need.total + SLEEP_LATENCY_MIN) * 60_000;
    const extras = [need.strain > 0 ? `today's strain adds ${formatMinutes(need.strain)}` : '', need.debt > 0 ? `catching up ${formatMinutes(need.debt)} of recent short nights` : '']
      .filter(Boolean)
      .join(', ');
    steps.push({
      kind: 'sleep',
      title: `In bed by ${formatTime(bedAt)}`,
      detail: `You need ${formatMinutes(need.total)} tonight${extras ? ` (${extras})` : ''} to wake at your usual ${formatTime(wakeAt)} fully recovered.`,
      href: '/sleep',
      priority: 3,
    });
  }

  // Steps, while there's still day left to walk them.
  if (m.steps && m.steps.total < STEP_GOAL && hour < 21) {
    const left = STEP_GOAL - m.steps.total;
    steps.push({
      kind: 'steps',
      title: `${formatCount(left)} steps to your ${formatCount(STEP_GOAL)}`,
      detail: `A ${Math.max(5, Math.round(left / 100 / 5) * 5)}-minute walk covers it.${m.steps.ghost > 300 ? ` (${formatCount(m.steps.ghost)} ghost steps were left out.)` : ''}`,
      href: '/metric/steps',
      priority: 4,
    });
  }

  // Weekly zone minutes, unless today is a recovery day.
  if (zone !== 'red' && m.weekly.minutes < 150) {
    const left = 150 - m.weekly.minutes;
    const doneToday = m.zones?.total ?? 0;
    if (doneToday < DAILY_ZONE_GOAL) {
      steps.push({
        kind: 'cardio',
        title: `${left} zone minutes left this week`,
        detail: `About ${Math.ceil(left / 2)} minutes of brisk cardio, or ${left} of fast walking. ${doneToday} so far today.`,
        href: '/metric/weeklyCardio',
        priority: 5,
      });
    }
  }

  // Protein, once some meals are logged and there's a weight to size the target.
  if (m.nutrition.meals.length && m.weightKg) {
    const target = Math.round(m.weightKg * PROTEIN_G_PER_KG);
    const have = m.nutrition.proteinG ?? 0;
    if (have < target * 0.9) {
      steps.push({
        kind: 'protein',
        title: `${target - have} g more protein today`,
        detail: `${have} g of about ${target} g (${PROTEIN_G_PER_KG} g per kg) from what you logged. Dal, paneer, eggs, curd or chicken get you there.`,
        href: '/metric/macros',
        priority: 6,
      });
    }
  } else if (!m.nutrition.meals.length && hour >= 14) {
    steps.push({
      kind: 'log',
      title: 'Tell the coach what you ate',
      detail: 'With meals logged, the coach can connect food to your sleep and recovery, and track protein.',
      href: '/coach',
      priority: 7,
    });
  }

  return steps.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

function minutesOfDay(t: number): number {
  const d = new Date(t);
  return d.getHours() * 60 + d.getMinutes();
}

function startOfDay(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
