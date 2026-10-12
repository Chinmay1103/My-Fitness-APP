import { habitImpact, strainLevel, type DailyScores, type DayData, type HabitImpact, type UserProfile } from '@fitness/scoring';
import type { Href } from 'expo-router';

import { formatCount, formatMinutes, formatTime } from './format';
import type { Logged } from './logged';
import type { DayMetrics, MetricDef } from './metrics';
import { workoutAnalysis } from './workoutAnalysis';
import { KINDS, type WorkoutKind } from './workouts';

/**
 * "What led here": plain sentences that put a number next to what happened around it (the day
 * before's strain and workouts, late meals, habits, the night's sleep), each opening the screen
 * behind it. Rule-based and explanatory only: nothing here changes a score.
 */

export interface WhyLine {
  text: string;
  href?: Href;
}

export interface WhyContext {
  days: DayData[];
  scores: DailyScores[];
  metrics: DayMetrics[];
  logged: Logged;
  profile: UserProfile;
}

/** Meals at or after this hour count as late. */
const LATE_MEAL_HOUR = 21;
/** Workouts ending at or after this hour can keep heart rate up into the night. */
const LATE_WORKOUT_HOUR = 20;

const workoutName = (w: { title?: string; kind: string }) => w.title || KINDS[w.kind as WorkoutKind]?.label || 'a workout';

/** Habit effect in words, when there's enough history to say: "on days with it, next-morning recovery is 9 points lower". */
function habitEffect(impact: HabitImpact | undefined, what: 'recovery' | 'sleep'): string {
  const diff = impact ? (what === 'recovery' ? impact.recoveryDiff : impact.sleepDiff) : null;
  if (diff == null || Math.abs(diff) < 2) return '';
  const lower = diff < 0;
  return ` After days with it your ${what === 'recovery' ? 'next-morning recovery' : 'sleep score'} is ${Math.abs(diff)} points ${lower ? 'lower' : 'higher'} on average${impact!.early ? ' (early read)' : ''}.`;
}

/**
 * The day before `index` (whose night and morning `index` scores): strain and its workouts, late
 * workouts, late meals and habits. `focus` picks which effect habits are described by.
 */
export function dayBeforeLines(ctx: WhyContext, index: number, focus: 'recovery' | 'sleep'): WhyLine[] {
  const lines: WhyLine[] = [];
  const before = ctx.scores[index - 1];
  const dayBefore = ctx.days[index - 1];
  if (!before || !dayBefore) return lines;

  const workouts = dayBefore.workouts ?? [];
  const strain = before.strain.strain;
  lines.push({
    text: `Strain ${strain.toFixed(1)} the day before (${strainLevel(strain).toLowerCase()})${
      workouts.length
        ? `, with ${workouts
            .map((w) => {
              const a = workoutAnalysis(w, ctx.days, ctx.logged, ctx.profile);
              return a ? `${workoutName(w)} (strain ${a.strain.toFixed(1)}, ${formatCount(a.calories.total)} kcal)` : workoutName(w);
            })
            .join(' and ')}`
        : before.strain.activities.length
          ? `, ${before.strain.activities.length} stretch${before.strain.activities.length === 1 ? '' : 'es'} of effort`
          : ''
    }.${strain >= 14 ? ' A hard day needs more sleep and usually costs some HRV the next morning.' : ''}`,
    href: '/strain',
  });

  const late = workouts.filter((w) => new Date(w.end).getHours() >= LATE_WORKOUT_HOUR || new Date(w.end).getDate() !== new Date(w.start).getDate());
  for (const w of late) {
    lines.push({
      text: `${workoutName(w)} ended at ${formatTime(w.end)}. Hard training close to bed keeps heart rate up and can delay deep sleep.`,
      href: { pathname: '/workout', params: { id: w.id } },
    });
  }

  const lateMeals = (ctx.metrics[index - 1]?.nutrition.meals ?? []).filter((m) => new Date(m.eatenAt).getHours() >= LATE_MEAL_HOUR);
  if (lateMeals.length) {
    lines.push({
      text: `Late eating: ${lateMeals.map((m) => `${m.description ?? 'a meal'} at ${formatTime(m.eatenAt)}`).join(', ')}. Digesting late often raises resting heart rate overnight.`,
      href: { pathname: '/metric/[key]', params: { key: 'caloriesIn' } },
    });
  }

  const habits = ctx.logged.habits.filter((h) => h.date === dayBefore.date);
  if (habits.length) {
    const impacts = habitImpact(ctx.logged.habits, ctx.scores);
    for (const h of habits) {
      lines.push({
        text: `Logged: ${h.kind}${h.amount ? ` (${h.amount})` : ''} at ${formatTime(h.occurredAt)}.${habitEffect(
          impacts.find((i) => i.kind === h.kind),
          focus,
        )}`,
        href: '/habits',
      });
    }
  }
  return lines;
}

/** The night's sleep against what was needed, for the morning numbers that depend on it. */
export function sleepLine(score: DailyScores | undefined): WhyLine | null {
  if (!score?.sleep) return null;
  const { asleepMinutes, needMinutes } = score.sleep;
  const short = needMinutes - asleepMinutes;
  return {
    text: `Slept ${formatMinutes(asleepMinutes)} of the ${formatMinutes(needMinutes)} needed (sleep ${score.sleep.score}%)${
      short > 45 ? `: ${formatMinutes(short)} short, which tends to lower HRV and raise resting heart rate` : ''
    }.`,
    href: '/sleep',
  };
}

/** Night signals that the day before can move: the ones a "what led here" makes sense for. */
const NIGHT_METRICS = new Set(['restingHr', 'hrv', 'breathing', 'skinTemp', 'spo2']);

/**
 * Why a metric is where it is on day `index`: how far from your usual, then what fed it (the day
 * before for night signals; the workouts for calories burned). Empty when there's nothing to say.
 */
export function metricLines(def: MetricDef, ctx: WhyContext, index: number): WhyLine[] {
  const m = ctx.metrics[index];
  const value = m ? def.value(m) : null;
  if (!m || value == null) return [];
  const lines: WhyLine[] = [];

  const history = ctx.metrics
    .slice(Math.max(0, index - 30), index)
    .map(def.value)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  if (history.length >= 5 && !def.goal) {
    const mid = history[Math.floor(history.length / 2)]!;
    const diff = value - mid;
    const same = Math.abs(diff) < Math.max(Math.abs(mid) * 0.03, 0.05);
    const good = def.higherIsBetter == null ? null : diff > 0 === def.higherIsBetter;
    lines.push({
      text: same
        ? `${def.format(value)} ${def.unit}: right at your usual ${def.format(mid)}.`
        : `${def.format(value)} ${def.unit}: ${def.format(Math.abs(diff))} ${diff > 0 ? 'above' : 'below'} your usual ${def.format(mid)}${
            good == null ? '' : good ? ', a good sign' : ', a sign your body is under more stress than usual'
          }.`,
    });
  }

  if (NIGHT_METRICS.has(def.key)) {
    const sleep = sleepLine(ctx.scores[index]);
    if (sleep) lines.push(sleep);
    lines.push(...dayBeforeLines(ctx, index, 'recovery'));
  }

  if (def.key === 'energy') {
    const day = ctx.days[index];
    let fromWorkouts = 0;
    for (const w of day?.workouts ?? []) {
      const a = workoutAnalysis(w, ctx.days, ctx.logged, ctx.profile);
      if (!a) continue;
      fromWorkouts += a.calories.active;
      lines.push({
        text: `${workoutName(w)} at ${formatTime(w.start)}: ${formatCount(a.calories.total)} kcal, ${formatCount(a.calories.active)} of them above resting.`,
        href: { pathname: '/workout', params: { id: w.id } },
      });
    }
    if (fromWorkouts > 0 && value > fromWorkouts) {
      lines.push({ text: `The other ${formatCount(value - fromWorkouts)} kcal are your body running all day plus everyday movement.` });
    }
  }
  return lines;
}
