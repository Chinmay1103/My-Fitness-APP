import type { DailyScores } from '@fitness/scoring';

import { formatMinutes } from './format';
import { normalRange, type MetricDef } from './metrics';
import type { TrendDef } from './trends';

/**
 * "How to read this": the (?) sheet on every screen. Four short answers: what it is, what's good,
 * what's usual for you (from your own last 30 days, when there's enough), and what to do about it.
 */

export interface Help {
  title: string;
  what: string;
  good: string;
  /** Your own numbers; left out until there are enough days. */
  you?: string;
  act: string;
}

const last30 = (scores: DailyScores[]) => scores.slice(-30);

/** "55–73" from the middle half of the values, or null under 5 values. */
function usual(values: (number | null | undefined)[], format: (v: number) => string): string | null {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 5) return null;
  const r = normalRange(v);
  return `${format(r.low)}–${format(r.high)}`;
}

export const HELP_TODAY: Help = {
  title: 'Reading Today',
  what:
    'Three rings: Recovery (how ready your body is, from last night), Strain (how hard today has been so far, 0–21) and Sleep (how well last night met your need). "Your day" under them turns those into three plain lines.',
  good: 'Green recovery, strain inside the day’s target, and sleep above 85%. The colors on everything follow one rule: green good, yellow okay, red worth watching, grey just information.',
  act: 'Read "Your day" first. If you only do one thing: hit the strain target and be in bed by the time it says. Tap any ring, tile or line for the reason behind it.',
};

export function recoveryHelp(scores: DailyScores[]): Help {
  const u = usual(last30(scores).map((s) => s.recovery?.score), (v) => `${Math.round(v)}`);
  return {
    title: 'Reading Recovery',
    what:
      'How ready your body is today, 0–100%, set each morning from last night: HRV, resting heart rate and sleep, compared with your own last 30 days (not other people).',
    good: 'Green 67%+: ready for a hard day. Yellow 34–66%: train, but keep it moderate. Red under 34%: rest, walk or stretch. One low day is normal; several red days in a row mean something is wearing you down.',
    you: u ? `Most of your mornings land between ${u}%.` : undefined,
    act: '"Why" shows which part pulled the score up or down, in points. Late meals, alcohol, short sleep and hard late workouts are the usual causes of a dip. Plan the day’s strain with it (see Strain).',
  };
}

export function sleepHelp(scores: DailyScores[]): Help {
  const s = last30(scores);
  const asleep = usual(s.map((x) => x.sleep?.asleepMinutes), (v) => formatMinutes(Math.round(v)));
  const need = usual(s.map((x) => x.sleep?.needMinutes), (v) => formatMinutes(Math.round(v)));
  return {
    title: 'Reading Sleep',
    what:
      'Sleep score = how much of the sleep you needed you got, with up to 30% off for poor quality (time awake in bed, little deep and REM, an unusual bedtime). Your need goes up after a hard day and after short nights.',
    good: '85%+ is a good night, 70–84% okay, under 70% a short one. Hours matter most: a short night can never score high.',
    you: asleep && need ? `You usually sleep ${asleep} and need ${need}.` : undefined,
    act: 'The surest fix is going to bed earlier at about the same time every night. "Your day" on Today gives tonight’s bedtime. Sleep debt (short nights) adds to the next nights’ need until it’s paid back.',
  };
}

export function strainHelp(scores: DailyScores[]): Help {
  const u = usual(last30(scores).map((s) => (s.strain.strain > 0 ? s.strain.strain : null)), (v) => v.toFixed(1));
  return {
    title: 'Reading Strain',
    what:
      'How hard your heart worked today, 0–21, from heart rate (plus the effort rating of logged workouts). It gets harder to raise the higher it goes: 10 is a normal active day, 14+ a proper workout, 18+ very hard.',
    good: 'There’s no "high is good": the right strain depends on recovery. Green morning: 14–18. Yellow: 10–14. Red: under 10.',
    you: u ? `Your usual day lands between ${u}.` : undefined,
    act: '"What’s driving today" says how far you are from the target and roughly how many minutes of steady cardio would get you there. Tell the coach about workouts the band saw so the effort and calories count.',
  };
}

export const HELP_HEART_RATE: Help = {
  title: 'Reading heart rate',
  what: 'Every reading the band sent today, colored by heart-rate zone (grey resting, then zones 1–5). The purple shading is when you slept; the dashed line is your resting heart rate.',
  good: 'Low and steady at rest, climbing during workouts and coming back down quickly afterwards. A resting line that’s higher than usual for several days can mean stress, illness or too little recovery.',
  act: 'Drag to read any moment; pinch to zoom in on a workout. The numbers arrive from Google Health in batches, so the latest minutes can lag.',
};

export function metricHelp(def: MetricDef, series: (number | null)[]): Help {
  const u = usual(series.slice(-30), def.format);
  return {
    title: `Reading ${def.label.toLowerCase()}`,
    what: def.about,
    good: def.goal
      ? `The goal is ${def.format(def.goal)} ${def.unit} a day.`
      : def.higherIsBetter == null
        ? 'Neither up nor down is good on its own; what matters is how it moves over weeks.'
        : `${def.higherIsBetter ? 'Higher' : 'Lower'} than your usual is the good direction. The shaded band on the chart is your normal range; the dashed line is your middle.`,
    you: u ? `Your usual: ${u} ${def.unit} (the middle half of the last 30 days).` : undefined,
    act: def.affects,
  };
}

export function trendHelp(def: TrendDef, values: (number | null)[]): Help {
  const u = usual(values.slice(-30), def.format);
  return {
    title: `Reading ${def.label.toLowerCase()}`,
    what: def.about,
    good: def.target ?? `${def.higherIsBetter ? 'Higher' : 'Lower'} is better.`,
    you: u ? `Your usual: ${u}${def.unit} (the middle half of the last 30 days).` : undefined,
    act: def.affects,
  };
}

export const HELP_BODY_AGE: Help = {
  title: 'Reading body age',
  what: 'How old your body acts, from nine things measured over the last 30 days (fitness, resting heart rate, steps, exercise minutes, strength training, sleep hours, bedtime regularity, weight). Each is turned into years using large health studies.',
  good: 'Younger than your real age is good. It moves slowly: expect changes over weeks, not days.',
  act: 'The levers list shows what would take the most years off at a realistic target. Usually that’s more moderate exercise, more steps or a steadier bedtime.',
};

export const HELP_BODY_CHECK: Help = {
  title: 'Reading body check',
  what: 'Skin temperature, breathing rate and resting heart rate at night, each against your own last 30 nights.',
  good: 'All three normal. One raised signal is common (a warm room, a late meal). Two or more raised together is often the first sign of getting ill, a day or two before you feel it.',
  act: 'When it says several signals are up: keep training light, drink water and sleep early. This is a wellness hint, not a diagnosis; see a doctor if you feel unwell.',
};

export const HELP_HABITS: Help = {
  title: 'Reading habits',
  what: 'Things you told the coach about (late coffee, drinks, a late dinner, screens in bed, meditation) and what your next morning looked like with and without them.',
  good: 'A habit with higher recovery or sleep after it is helping you; lower means it costs you. "Early read" means only a few days so far.',
  act: 'Keep telling the coach about these when they happen; the comparison gets reliable after a couple of weeks of each.',
};

export const HELP_WEEKLY: Help = {
  title: 'Reading the weekly report',
  what: 'The last 7 days against the week before: average recovery, strain, sleep and the trend in each, plus one thing to focus on next week.',
  good: 'Steady or rising recovery while strain holds is the sign you’re handling your training.',
  act: 'Ask the coach "how did my week go?" on Sunday or Monday; it writes the report here.',
};

export const HELP_WORKOUTS: Help = {
  title: 'Reading workouts',
  what: 'Every workout you told the coach about, and for lifting, each exercise’s best set over time (as an estimated one-rep max).',
  good: '"Progressing" means your best set is going up; "holding" is within 2%; "slipping" is down.',
  act: 'When you can do 12 good reps of a set, go up a step in weight. Tap a workout for how hard it really was and what it burned.',
};

export const HELP_WORKOUT: Help = {
  title: 'Reading a workout',
  what: 'Your heart rate over exactly the workout’s start-to-end time: minutes in each zone, the strain of the workout alone and the calories it burned.',
  good: 'Compare "heart rate says" with the effort you gave it. Lifting usually feels harder than heart rate shows; that’s what the effort rating adds.',
  act: 'Give the coach an effort rating (1–10) for each workout, and your weight, age, sex and height, so strain and calories are your own.',
};

export const HELP_LIVE: Help = {
  title: 'Reading live heart rate',
  what: 'Your heart rate second by second, straight from the band over Bluetooth, colored by zone.',
  good: 'Zone 2 (easy, can talk) builds endurance; zones 4–5 are hard efforts you can only hold for minutes.',
  act: 'Use it during a workout to stay in the zone you want. It’s only for watching; scores come from Health Connect.',
};

export const HELP_COACH: Help = {
  title: 'Using the coach',
  what: 'The coach is a Claude chat that can read your scores and record what you tell it: workouts, meals, weight, habits and facts about you.',
  good: 'Tell it things as they happen, in your own words ("ran 5 km from 6:10 to 6:45, felt like a 7"). The more it knows, the better the explanations.',
  act: 'Ask "how’s my day?" for a plain explanation; it saves a note that shows on Today. Ask "how did my week go?" for the weekly report.',
};

export const HELP_ACTIVITY: Help = {
  title: 'Reading an activity',
  what: 'A stretch of effort the band noticed from your heart rate: when it started and ended, the zones and the strain it added.',
  good: 'Nothing to judge here; it shows what counted toward the day’s strain.',
  act: 'If it was a workout, tell the coach what it was and how hard it felt, so it’s named and its effort counts.',
};
