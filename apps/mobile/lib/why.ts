import {
  habitImpact,
  sleepNeed,
  strainLevel,
  type DailyScores,
  type DayData,
  type HabitImpact,
  type RecoveryFactor,
  type UserProfile,
} from '@fitness/scoring';
import type { Href } from 'expo-router';

import { formatCount, formatMinutes, formatTime } from './format';
import type { Logged } from './logged';
import type { DayMetrics, MetricDef } from './metrics';
import { STRAIN_TARGETS } from './nextSteps';
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

/**
 * "Late" is relative to that night's bedtime, not the clock: a 9:30 pm dinner is late for someone
 * asleep at 10:30, not for someone asleep at 1 am. Meals and hard workouts within this long of
 * falling asleep count. Without a recorded bedtime, 9 pm (meals) and 8 pm (workouts) stand in.
 */
const LATE_BEFORE_BED_MS = 2 * 3_600_000;
const FALLBACK_MEAL_HOUR = 21;
const FALLBACK_WORKOUT_HOUR = 20;

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

  const bedtime = ctx.days[index]?.sleep?.start;
  const isLate = (t: number, fallbackHour: number) =>
    bedtime != null ? t <= bedtime && bedtime - t <= LATE_BEFORE_BED_MS : new Date(t).getHours() >= fallbackHour;
  const late = workouts.filter((w) => isLate(w.end, FALLBACK_WORKOUT_HOUR));
  for (const w of late) {
    lines.push({
      text: `${workoutName(w)} ended at ${formatTime(w.end)}${bedtime != null ? `, ${formatMinutes(Math.round((bedtime - w.end) / 60_000))} before you fell asleep` : ''}. Hard training close to bed keeps heart rate up and can delay deep sleep.`,
      href: { pathname: '/workout', params: { id: w.id } },
    });
  }

  // Meals from the evening before and any after midnight but before bed.
  const meals = [...(ctx.metrics[index - 1]?.nutrition.meals ?? []), ...(ctx.metrics[index]?.nutrition.meals ?? [])];
  const lateMeals = meals.filter((m) => isLate(m.eatenAt, FALLBACK_MEAL_HOUR) && (bedtime != null || ctx.metrics[index - 1]?.nutrition.meals.includes(m)));
  if (lateMeals.length) {
    lines.push({
      text: `Eating close to bed: ${lateMeals.map((m) => `${m.description ?? 'a meal'} at ${formatTime(m.eatenAt)}`).join(', ')}${bedtime != null ? `, within 2 h of falling asleep at ${formatTime(bedtime)}` : ''}. Digesting in bed often raises resting heart rate overnight.`,
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

  const streak = streakLine(def, ctx, index);
  if (streak) lines.push(streak);

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

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))}`;

/** One recovery factor's value, or its move between two mornings: "HRV 61 → 48 ms". */
function factorMove(key: RecoveryFactor['key'], before: number | undefined, now: number): string {
  const from = before == null ? '' : `${before} → `;
  switch (key) {
    case 'hrv':
      return `HRV ${from}${now} ms`;
    case 'restingHr':
      return `resting heart rate ${from}${now} bpm`;
    case 'respiratoryRate':
      return `breathing ${from}${now} breaths/min`;
    case 'sleep':
      return `sleep score ${from}${now}%`;
  }
}

const FACTOR_HREF: Record<RecoveryFactor['key'], Href> = {
  hrv: { pathname: '/metric/[key]', params: { key: 'hrv' } },
  restingHr: { pathname: '/metric/[key]', params: { key: 'restingHr' } },
  respiratoryRate: { pathname: '/metric/[key]', params: { key: 'breathing' } },
  sleep: '/sleep',
};

/**
 * The lead "why" on Recovery, worked out from the day's numbers rather than a fixed sentence: how
 * far the score moved since the morning before and which factor moved it most, then which factor
 * has the biggest say against a typical night.
 */
export function recoveryChangeLines(ctx: WhyContext, index: number): WhyLine[] {
  const now = ctx.scores[index]?.recovery;
  if (!now?.breakdown || now.score == null) return [];
  const lines: WhyLine[] = [];
  const prev = ctx.scores[index - 1]?.recovery;

  if (prev?.breakdown && prev.score != null) {
    const diff = now.score - prev.score;
    const top = now.breakdown.factors
      .map((f) => {
        const p = prev.breakdown!.factors.find((x) => x.key === f.key);
        return { f, p, d: f.points - (p?.points ?? 0) };
      })
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
    if (Math.abs(diff) < 3 || !top) {
      lines.push({ text: `About the same as the morning before (${prev.score}% → ${now.score}%): nothing moved much overnight.` });
    } else {
      lines.push({
        text: `${diff > 0 ? 'Up' : 'Down'} ${Math.abs(diff)} points from the morning before (${prev.score}% → ${now.score}%), mostly from ${factorMove(
          top.f.key,
          top.p?.today,
          top.f.today,
        )} (${signed(top.d)} points).`,
        href: FACTOR_HREF[top.f.key],
      });
    }
  }

  const biggest = [...now.breakdown.factors].sort((a, b) => Math.abs(b.points) - Math.abs(a.points))[0];
  if (biggest && Math.abs(biggest.points) >= 2) {
    lines.push({
      text: `Biggest say today: ${factorMove(biggest.key, undefined, biggest.today)} against your usual ${biggest.baseline}${
        biggest.key === 'sleep' ? '%' : ''
      }, ${signed(biggest.points)} points on a typical night's ${now.breakdown.typical}%.`,
      href: FACTOR_HREF[biggest.key],
    });
  }
  return lines;
}

/**
 * The lead "why" on Sleep: how far the score moved since the night before, and whether hours,
 * need or one of the quality measures did it.
 */
export function sleepChangeLines(ctx: WhyContext, index: number): WhyLine[] {
  const now = ctx.scores[index];
  const prev = ctx.scores[index - 1];
  if (!now?.sleep || !prev?.sleep) return [];
  const a = now.sleep;
  const b = prev.sleep;
  const diff = a.score - b.score;
  if (Math.abs(diff) < 3) return [{ text: `About the same as the night before (${b.score}% → ${a.score}%).` }];

  const top = [
    { what: 'hours', d: a.breakdown.ceiling - b.breakdown.ceiling },
    { what: 'efficiency', d: b.breakdown.penalties.efficiency - a.breakdown.penalties.efficiency },
    { what: 'restorative', d: b.breakdown.penalties.restorative - a.breakdown.penalties.restorative },
    { what: 'consistency', d: b.breakdown.penalties.consistency - a.breakdown.penalties.consistency },
  ].sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0]!;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  let because: string;
  let key: string;
  if (top.what === 'hours') {
    // The hours ceiling is asleep / need, so either can move it: name whichever moved it more
    // (a hard day or sleep debt raising the need, rather than "7h 49m vs 7h 54m").
    const needMoved = Math.abs(Math.log(a.needMinutes / b.needMinutes)) > Math.abs(Math.log(Math.max(a.asleepMinutes, 1) / Math.max(b.asleepMinutes, 1)));
    because = needMoved
      ? `because you needed ${formatMinutes(a.needMinutes)} instead of ${formatMinutes(b.needMinutes)}`
      : `from sleeping ${formatMinutes(a.asleepMinutes)} vs ${formatMinutes(b.asleepMinutes)}`;
    key = needMoved ? 'sleepNeed' : 'hoursSlept';
  } else if (top.what === 'efficiency') {
    because = `from time awake in bed (efficiency ${pct(b.efficiency)} → ${pct(a.efficiency)})`;
    key = 'efficiency';
  } else if (top.what === 'restorative') {
    because = `from the deep + REM share ${pct(b.restorativeRatio)} → ${pct(a.restorativeRatio)}`;
    key = 'restorative';
  } else {
    because = `from bedtime consistency ${pct(b.consistency)} → ${pct(a.consistency)}`;
    key = 'consistency';
  }
  return [
    {
      text: `${diff > 0 ? 'Up' : 'Down'} ${Math.abs(diff)} points from the night before (${b.score}% → ${a.score}%), mostly ${because}.`,
      href: { pathname: '/trend/[key]', params: { key } },
    },
  ];
}

/** TRIMP behind a strain score (strainFromTrimp backwards), and per minute of steady zone 2–3 cardio (65% of reserve). */
const trimpFor = (strain: number) => -120 * Math.log(1 - Math.min(strain, 20.9) / 21);
const STEADY_TRIMP_PER_MIN = 0.65 * 0.64 * Math.exp(1.92 * 0.65);

/** Roughly how many minutes of steady zone 2–3 cardio take a day's `trimp` to `targetStrain`, in steps of 5. */
export function steadyMinutesTo(targetStrain: number, trimp: number): number {
  return Math.max(5, Math.round((trimpFor(targetStrain) - trimp) / STEADY_TRIMP_PER_MIN / 5) * 5);
}

/**
 * Why the day's strain is where it is: against your usual day, what built it, what isn't logged,
 * how far from the target the morning's recovery set, and what it adds to that night's sleep need.
 */
export function strainLines(ctx: WhyContext, index: number, isLatest: boolean): WhyLine[] {
  const score = ctx.scores[index];
  if (!score) return [];
  const { strain, activities, everydayStrain, trimp } = score.strain;
  const lines: WhyLine[] = [];
  const soFar = isLatest ? ' so far' : '';

  const history = ctx.scores
    .slice(Math.max(0, index - 30), index)
    .map((s) => s.strain.strain)
    .filter((s) => s > 0)
    .sort((a, b) => a - b);
  if (history.length >= 5) {
    const usual = history[Math.floor(history.length / 2)]!;
    const d = strain - usual;
    lines.push({
      text:
        Math.abs(d) < 0.5
          ? `Strain ${strain.toFixed(1)}${soFar}: right at your usual day (${usual.toFixed(1)}).`
          : `Strain ${strain.toFixed(1)}${soFar}: ${Math.abs(d).toFixed(1)} ${d > 0 ? 'above' : 'below'} your usual day (${usual.toFixed(1)}).`,
      href: { pathname: '/metric/[key]', params: { key: 'trainingLoad' } },
    });
  }

  const top = [...activities].sort((a, b) => b.strain - a.strain)[0];
  if (top && strain > 0) {
    const name = top.workout ? workoutName(top.workout) : 'an unlogged effort';
    lines.push({
      text: `${activities.length > 1 ? 'Most of it' : 'It'} came from ${name} (${formatTime(top.start)}–${formatTime(top.end)}): ${top.strain.toFixed(1)} of ${strain.toFixed(1)}${
        top.effortStrain ? `, ${top.effortStrain.toFixed(1)} of that from your effort rating` : ''
      }.${everydayStrain >= 1 ? ` Everyday movement added ${everydayStrain.toFixed(1)}.` : ''}`,
      href: top.workout
        ? { pathname: '/workout', params: { id: top.workout.id } }
        : { pathname: '/activity', params: { date: score.date, start: String(top.start) } },
    });
  } else if (strain > 0) {
    lines.push({
      text: `No long efforts${isLatest ? ' yet' : ''}: all ${strain.toFixed(1)} is everyday movement (walking, stairs, chores).`,
      href: { pathname: '/metric/[key]', params: { key: 'steps' } },
    });
  }

  // Only efforts worth logging; a walk to the shop shouldn't nag every day.
  const unlogged = activities.filter((a) => !a.workout && a.minutes >= 15);
  if (unlogged.length) {
    const one = unlogged.length === 1;
    lines.push({
      text: `${one ? 'The effort' : `${unlogged.length} efforts`} at ${unlogged.map((a) => formatTime(a.start)).join(', ')} ${
        one ? "isn't" : "aren't"
      } logged. Tell the coach what you did so the effort rating and calories count.`,
      href: '/coach',
    });
  }

  const zone = score.recovery?.zone;
  if (zone) {
    const [lo, hi] = STRAIN_TARGETS[zone];
    if (strain < lo) {
      const minutes = steadyMinutesTo(lo, trimp);
      lines.push({
        text: isLatest
          ? `${(lo - strain).toFixed(1)} below today's target (${lo}–${hi}, set by a ${zone} recovery): about ${formatMinutes(minutes)} of steady cardio (zone 2–3) would get you there.`
          : `Ended ${(lo - strain).toFixed(1)} below that day's target (${lo}–${hi}, ${zone} recovery).`,
        href: '/recovery',
      });
    } else if (strain <= hi) {
      lines.push({ text: `In the target (${lo}–${hi}) for a ${zone} recovery${isLatest ? ': anything more is optional' : ''}.`, href: '/recovery' });
    } else {
      lines.push({
        text: `${(strain - hi).toFixed(1)} over the target (${lo}–${hi}) for a ${zone} recovery${
          zone === 'green' ? '' : ': expect a lower recovery next morning, and protect the night’s sleep'
        }.`,
        href: '/recovery',
      });
    }
  }

  const extra = sleepNeed({ priorDayStrain: strain, baseNeedMinutes: 0 }).strain;
  if (extra >= 5) {
    lines.push({
      text: `${isLatest ? 'Today’s' : 'That day’s'} strain adds about ${formatMinutes(Math.round(extra))} to ${isLatest ? "tonight's" : "that night's"} sleep need.`,
      href: { pathname: '/trend/[key]', params: { key: 'sleepNeed' } },
    });
  }
  return lines;
}

/** "Rising 4 days in a row (52 → 61 ms)" when a metric keeps moving one way; null otherwise. */
export function streakLine(def: MetricDef, ctx: WhyContext, index: number): WhyLine | null {
  // Today's daily counts (steps, calories) are still filling up, so they'd always look like a fall.
  if (def.chart === 'bars' && index === ctx.metrics.length - 1) return null;
  const vals: number[] = [];
  for (let i = index; i >= 0 && vals.length < 15; i--) {
    const v = ctx.metrics[i] ? def.value(ctx.metrics[i]!) : null;
    if (v == null) break;
    vals.unshift(v);
  }
  const last = vals.length - 1;
  if (last < 3) return null;
  const dir = Math.sign(vals[last]! - vals[last - 1]!);
  if (dir === 0) return null;
  let run = 1;
  while (run < last && Math.sign(vals[last - run]! - vals[last - run - 1]!) === dir) run++;
  if (run < 3) return null;
  const good = def.higherIsBetter == null ? '' : dir > 0 === def.higherIsBetter ? ', heading the good way' : ', worth keeping an eye on';
  return {
    text: `${dir > 0 ? 'Rising' : 'Falling'} ${run} days in a row (${def.format(vals[last - run]!)} → ${def.format(vals[last]!)} ${def.unit})${good}.`,
  };
}
