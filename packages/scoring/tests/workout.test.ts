import { describe, expect, it } from "vitest";
import {
  analyzeWorkout,
  ageOn,
  computeStrain,
  keytelKcalPerMinute,
  type HeartRateSample,
  type LoggedWorkout,
} from "../src";

const MIN = 60_000;
const profile = { age: 28, weightKg: 70, sex: "male" as const }; // max HR 188
const steady = (bpm: number, minutes: number, from = 0): HeartRateSample[] =>
  Array.from({ length: minutes + 1 }, (_, i) => ({ time: from + i * MIN, bpm }));
const run: LoggedWorkout = { id: "r", start: 0, end: 45 * MIN, kind: "run" };
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

describe("analyzeWorkout", () => {
  it("measures only the workout's own time", () => {
    // An hour at 160, but only the first 45 minutes are the run.
    const a = analyzeWorkout(run, steady(160, 60), 60, profile);
    expect(a.minutes).toBe(45);
    expect(a.heartRateMinutes).toBe(45);
    expect(a.avgBpm).toBe(160);
    expect(a.peakBpm).toBe(160);
    expect(a.avgReserve).toBeCloseTo(100 / 128, 2);
    expect(a.zoneMinutes[4]).toBe(45); // 78% of reserve: zone 4
  });

  it("gives the same strain as the day's strain for the same heart rate", () => {
    const samples = steady(150, 45);
    expect(analyzeWorkout(run, samples, 60, profile).strain).toBe(computeStrain(samples, 60, profile).strain);
  });

  it("strain parts and calorie parts add up exactly", () => {
    const samples = [...steady(95, 10), ...steady(130, 15, 10 * MIN), ...steady(175, 20, 25 * MIN)];
    const a = analyzeWorkout({ ...run, effort: 9 }, samples, 58, profile);
    expect(sum([...a.strainParts.zones, a.strainParts.effort])).toBeCloseTo(a.strain, 5);
    const c = a.calories;
    expect(c.resting + sum(c.extra.zones) + c.extra.noHeartRate).toBe(c.total);
    expect(c.active).toBe(c.total - c.resting);
  });

  it("tops up a calm lifting session with its effort rating, like the day's strain", () => {
    const lift: LoggedWorkout = { id: "l", start: 0, end: 60 * MIN, kind: "strength", effort: 8 };
    const a = analyzeWorkout(lift, steady(100, 60), 60, profile);
    expect(a.strain).toBeCloseTo(13.3, 0);
    expect(a.strainParts.effort).toBeGreaterThan(a.strain / 2);
    // Heart rate alone matched a much easier session than it felt.
    expect(a.heartRateEffort).toBeLessThanOrEqual(3);
  });

  it("burns believable calories: a hard 45-minute run ~500-750 kcal, a sit ~resting", () => {
    const hard = analyzeWorkout(run, steady(160, 45), 60, profile).calories;
    expect(hard.total).toBeGreaterThan(500);
    expect(hard.total).toBeLessThan(750);
    expect(hard.resting).toBe(53); // 70 kg x 45 min / 60
    const sitting = analyzeWorkout(run, steady(60, 45), 60, profile).calories;
    expect(sitting.total).toBe(sitting.resting);
  });

  it("estimates minutes without heart rate from the kind of workout", () => {
    const a = analyzeWorkout(run, [], 60, profile);
    expect(a.heartRateMinutes).toBe(0);
    expect(a.avgBpm).toBeNull();
    expect(a.heartRateEffort).toBeNull();
    // 9 METs x 70 kg x 0.75 h
    expect(a.calories.total).toBe(473);
    expect(a.calories.extra.noHeartRate).toBe(a.calories.total - a.calories.resting);
  });

  it("says which inputs were defaults", () => {
    const a = analyzeWorkout(run, steady(150, 45), 60, { age: 30 });
    expect(a.calories.basis).toMatchObject({ weightKg: 70, weightKnown: false, ageKnown: false });
    expect(a.calories.basis.sex).toBeUndefined();
  });
});

describe("keytelKcalPerMinute", () => {
  it("is higher for men at the same heart rate and averages without a sex", () => {
    const m = keytelKcalPerMinute(150, 70, 30, "male");
    const f = keytelKcalPerMinute(150, 70, 30, "female");
    expect(m).toBeGreaterThan(f);
    expect(keytelKcalPerMinute(150, 70, 30)).toBeCloseTo((m + f) / 2);
  });
});

describe("ageOn", () => {
  it("counts birthdays", () => {
    expect(ageOn("1998-10-12", new Date(2026, 9, 12).getTime())).toBe(28);
    expect(ageOn("1998-10-13", new Date(2026, 9, 12).getTime())).toBe(27);
  });
});
