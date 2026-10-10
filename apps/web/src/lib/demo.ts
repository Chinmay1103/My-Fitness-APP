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
    workouts: raw.flatMap((d) =>
      (d.workouts ?? []).map((w) => ({
        id: w.id,
        date: localDate(w.start),
        start: w.start,
        end: w.end,
        kind: w.kind,
        title: w.title ?? null,
        effort: w.effort ?? null,
        distanceKm: null,
        notes: null,
      })),
    ),
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
