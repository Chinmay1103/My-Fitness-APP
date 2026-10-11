import {
  activeZoneMinutes,
  combineSteps,
  computeDailyScores,
  daySamples,
  generateMockDays,
  generateMockHabits,
  MOCK_PROFILE,
} from '@fitness/scoring';

import { dayFromRow, type Dataset, type Meal, type Weight } from './data';
import { addDays, localDate, today } from './dates';

const DEMO_DAYS = 400;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Push / pull / legs in turn, with weights creeping up over the year the way a real log does:
 * steady gains, plateaus, a lift that slips (overhead press) and bodyweight pull-ups adding reps.
 */
const PLAN = [
  {
    title: 'Push day',
    lifts: [
      { name: 'Bench press', start: 50, perMonth: 1.6, reps: 8 },
      { name: 'Overhead press', start: 35, perMonth: 0.6, reps: 6, slipAfter: 0.6 },
      { name: 'Incline dumbbell press', start: 18, perMonth: 0.6, reps: 10 },
      { name: 'Tricep pushdown', start: 20, perMonth: 0.5, reps: 12 },
      { name: 'Lateral raise', start: 6, perMonth: 0.15, reps: 15 },
    ],
  },
  {
    title: 'Pull day',
    lifts: [
      { name: 'Deadlift', start: 80, perMonth: 2.4, reps: 5 },
      { name: 'Pull-ups', start: 5, perMonth: 0.5, reps: 0 },
      { name: 'Barbell row', start: 45, perMonth: 1, reps: 8 },
      { name: 'Bicep curl', start: 10, perMonth: 0, reps: 10 },
      { name: 'Face pull', start: 15, perMonth: 0.4, reps: 15 },
    ],
  },
  {
    title: 'Leg day',
    lifts: [
      { name: 'Back squat', start: 60, perMonth: 2, reps: 6 },
      { name: 'Romanian deadlift', start: 50, perMonth: 1.2, reps: 8 },
      { name: 'Leg press', start: 100, perMonth: 3, reps: 10 },
      { name: 'Standing calf raise', start: 40, perMonth: 0, reps: 12 },
      { name: 'Plank', start: 0, perMonth: 0, reps: 0 },
    ],
  },
];

function demoSession(index: number, start: number) {
  const day = PLAN[index % PLAN.length]!;
  const monthsIn = (start - (Date.now() - DEMO_DAYS * 86_400_000)) / (30 * 86_400_000);
  const progress = monthsIn / (DEMO_DAYS / 30);
  return {
    title: day.title,
    exercises: day.lifts
      .filter((l) => l.name !== 'Plank')
      .map((l) => {
        if (l.reps === 0) {
          // Bodyweight: reps go up instead of weight.
          const reps = Math.round(l.start + l.perMonth * monthsIn);
          return { name: l.name, sets: [reps, reps - 1, reps - 2].map((r) => ({ reps: r, weightKg: null })) };
        }
        // Weights move in 2.5 kg plates; the overhead press slips back late in the year.
        const months = l.slipAfter != null && progress > l.slipAfter ? monthsIn - (progress - l.slipAfter) * 30 : monthsIn;
        const kg = Math.max(2.5, Math.round((l.start + l.perMonth * months) / 2.5) * 2.5);
        return { name: l.name, sets: Array.from({ length: 3 }, () => ({ reps: l.reps, weightKg: kg })) };
      }),
  };
}

/**
 * A year and a bit of made-up days from the same generator the phone uses, scored with the real
 * scoring code, so the website can be tried before the band has filled the cloud. Never uploaded.
 */
export function demoDataset(): Dataset {
  const raw = generateMockDays({ days: DEMO_DAYS, endDate: today() });
  const scores = computeDailyScores(raw, MOCK_PROFILE);
  const days = raw.map((d, i) => {
    const restingHr = d.restingHr ?? 60;
    return dayFromRow({
      date: d.date,
      resting_hr: d.restingHr ?? null,
      hrv_rmssd: d.hrvRmssd ?? null,
      sleep_start: d.sleep ? new Date(d.sleep.start).toISOString() : null,
      sleep_end: d.sleep ? new Date(d.sleep.end).toISOString() : null,
      asleep_minutes: null,
      heart_rate: { avg: Math.round(daySamples(d).reduce((a, s) => a + s.bpm, 0) / Math.max(1, daySamples(d).length)) },
      extras: {
        steps: d.steps?.length ? combineSteps(d.steps, daySamples(d), restingHr).total : null,
        zone_minutes: activeZoneMinutes(d.heartRate, restingHr, MOCK_PROFILE).total,
        spo2: d.spo2 ?? null,
        breathing: d.respiratoryRate ?? null,
        skin_temp_delta: d.skinTempDelta ?? null,
        calories_burned: d.caloriesBurned ?? null,
        sleep_stages: d.sleep?.stages ?? null,
      },
      scores: scores[i]!,
    });
  });

  // Meals and weigh-ins aren't in the phone's generator; a simple made-up diet and a slow cut.
  const rand = mulberry32(11);
  const meals: Meal[] = [];
  const weights: Weight[] = [];
  let kg = 68;
  raw.forEach((d, i) => {
    if (rand() < 0.8) {
      const calories = Math.round(1900 + (rand() - 0.5) * 700);
      const at = Date.parse(`${d.date}T20:00:00`);
      meals.push({
        id: `demo-meal-${i}`,
        date: d.date,
        eatenAt: at,
        description: "The day's meals",
        calories,
        proteinG: Math.round(60 + rand() * 50),
        carbsG: Math.round(calories * 0.13),
        fatG: Math.round(calories * 0.03),
      });
    }
    kg += -0.008 + (rand() - 0.5) * 0.25;
    if (i % 3 === 0) weights.push({ date: d.date, measuredAt: Date.parse(`${d.date}T07:30:00`), kg: Math.round(kg * 10) / 10 });
  });

  return {
    timeZone: undefined,
    demo: true,
    days,
    workouts: raw
      .flatMap((d) => d.workouts ?? [])
      .map((w, i) => {
        const gym = w.kind === 'strength' ? demoSession(i, w.start) : null;
        return {
          id: w.id,
          date: localDate(w.start),
          start: w.start,
          end: w.end,
          kind: w.kind,
          title: gym?.title ?? w.title ?? null,
          effort: w.effort ?? null,
          distanceKm: null,
          notes: null,
          exercises: gym?.exercises ?? [],
        };
      }),
    meals,
    weights,
    habits: generateMockHabits(raw).map((h) => ({ date: h.date, kind: h.kind, amount: h.amount ?? null, note: null })),
    notes: [
      {
        date: addDays(today(), 0),
        headline: 'Demo note: a steady day after two hard ones',
        why: 'This is demo data. Once you sign in, the notes Claude saved through the coach connector show here, one per day.',
        tips: ['Sign in to see your own history'],
      },
    ],
    reports: [],
  };
}
