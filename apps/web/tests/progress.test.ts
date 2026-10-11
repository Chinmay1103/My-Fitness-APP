import { describe, expect, it } from 'vitest';

import type { Dataset, Meal, Workout } from '../src/lib/data';
import { addDays } from '../src/lib/dates';
import { buildRows } from '../src/lib/metrics';
import { exerciseSessions, foodDays, foodHits, goalTrack, weeklyRate, weeklyWeights, weeksToGoal, workoutGroup } from '../src/lib/progress';

const start = '2026-08-17'; // a Monday

function dataset(over: Partial<Dataset>): Dataset {
  return { days: [], workouts: [], meals: [], weights: [], habits: [], notes: [], reports: [], goals: { weightKg: null, calories: null, proteinG: null }, timeZone: undefined, demo: false, ...over };
}

function meal(date: string, calories: number, proteinG: number, hour = 13): Meal {
  return { id: `${date}-${hour}`, date, eatenAt: Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00Z`), description: 'x', calories, proteinG, carbsG: null, fatG: null };
}

function workout(date: string, exercises: Workout['exercises'], kind = 'strength'): Workout {
  const t = Date.parse(`${date}T18:00:00Z`);
  return { id: date + kind, date, start: t, end: t + 3_600_000, kind, title: null, effort: null, distanceKm: null, notes: null, exercises };
}

describe('weight against a goal', () => {
  // 0.1 kg a day up from 59.3 for four weeks, a weigh-in every day.
  const weights = Array.from({ length: 28 }, (_, i) => ({ date: addDays(start, i), measuredAt: 0, kg: 59.3 + 0.1 * i }));
  const rows = buildRows(dataset({ weights }), start, addDays(start, 27));

  it('fits the weekly rate through the weigh-ins', () => {
    expect(weeklyRate(rows)).toBeCloseTo(0.7, 5);
  });

  it('runs from the first 7-day average to the latest one', () => {
    const t = goalTrack(rows, 65)!;
    expect(t.start).toBeCloseTo(59.3);
    expect(t.now).toBeCloseTo(59.3 + 0.1 * 24); // the last 7 days average at day 24
    expect(t.direction).toBe('gain');
    expect(t.done).toBeCloseTo(2.4 / 5.7);
  });

  it('works for a weight-loss goal and clamps moving the wrong way to 0', () => {
    const t = goalTrack(rows, 55)!;
    expect(t.direction).toBe('lose');
    expect(t.done).toBe(0);
    expect(goalTrack(rows, null)).toBeNull();
  });

  it('counts weeks to the goal in either direction', () => {
    expect(weeksToGoal(60, 65, 0.25)).toBe(20);
    expect(weeksToGoal(70, 65, 0.5)).toBe(10);
    expect(weeksToGoal(60, 65, 0)).toBe(Infinity);
  });

  it('averages each Monday-to-Sunday week', () => {
    const weeks = weeklyWeights(rows);
    expect(weeks).toHaveLength(4);
    expect(weeks[0]!.avg).toBeCloseTo(59.6);
    expect(weeks[1]!.change).toBeCloseTo(0.7);
    expect(weeks[0]!.readings).toBe(7);
  });
});

describe('food against targets', () => {
  const meals = [meal(start, 1200, 50), meal(start, 1300, 70, 20), meal(addDays(start, 1), 2000, 120), meal(addDays(start, 2), 600, 30)];
  const goals = { weightKg: null, calories: 2400, proteinG: 110 };
  const rows = buildRows(dataset({ meals }), start, addDays(start, 3));

  it('adds up each day and marks days logged under half the target as partial', () => {
    const days = foodDays(rows, meals, goals);
    expect(days.map((d) => [d.calories, d.protein, d.partial])).toEqual([
      [2500, 120, false],
      [2000, 120, false],
      [600, 30, true],
    ]);
    expect(days[0]!.meals).toHaveLength(2);
  });

  it('leaves partial days out of the hit rate and averages', () => {
    const hits = foodHits(foodDays(rows, meals, goals), goals);
    expect(hits).toMatchObject({ days: 2, partial: 1, avgCalories: 2250, avgProtein: 120, calorieHits: 1, proteinHits: 2 });
    expect(foodHits(foodDays(rows, meals, { ...goals, calories: null }), { ...goals, calories: null }).calorieHits).toBeNull();
  });
});

describe('lift sessions', () => {
  const workouts = [
    workout(start, [{ name: 'Cable row', sets: [{ reps: 12, weightKg: 55 }, { reps: 10, weightKg: 60 }] }]),
    workout(addDays(start, 7), [{ name: 'Cable Rows', sets: [{ reps: 12, weightKg: 55 }, { reps: 12, weightKg: 60 }, { reps: 12, weightKg: 60 }] }]),
  ];

  it('matches the exercise by name and picks the best set', () => {
    const s = exerciseSessions(workouts, 'cable row');
    expect(s).toHaveLength(2);
    expect(s[0]!.top).toBe(1);
    expect(s[0]!.readyForMore).toBe(false);
    // Every set at 60 kg reached 12: time to go up.
    expect(s[1]!.readyForMore).toBe(true);
  });

  it('sorts workouts into upper, lower and cardio', () => {
    expect(workoutGroup(workouts[0]!)).toBe('upper');
    expect(workoutGroup(workout(start, [{ name: 'Leg press', sets: [] }, { name: 'Romanian deadlift', sets: [] }, { name: 'Lat pulldown', sets: [] }]))).toBe('lower');
    expect(workoutGroup(workout(start, [], 'run'))).toBe('cardio');
    expect(workoutGroup(workout(start, [], 'sport'))).toBe('other');
  });
});
