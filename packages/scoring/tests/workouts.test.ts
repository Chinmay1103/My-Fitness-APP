import { describe, expect, it } from "vitest";
import {
  activeZoneMinutes,
  computeRecovery,
  computeStrain,
  weeklyZoneProgress,
  type HeartRateSample,
  type LoggedWorkout,
  type NightMetrics,
} from "../src";

const profile = { age: 28 }; // max HR 188
const MIN = 60_000;
const steady = (bpm: number, minutes: number, from = 0): HeartRateSample[] =>
  Array.from({ length: minutes + 1 }, (_, i) => ({ time: from + i * MIN, bpm }));
const lift: LoggedWorkout = { id: "w1", start: 0, end: 60 * MIN, kind: "strength", title: "Leg day", effort: 8 };

describe("logged workouts in strain", () => {
  it("tops up a calm lifting session to what its effort rating says", () => {
    // Heart rate around 100 while lifting: barely any strain on heart rate alone.
    const hrOnly = computeStrain(steady(100, 60), 60, profile);
    const withLog = computeStrain(steady(100, 60), 60, profile, [lift]);
    expect(hrOnly.strain).toBeLessThan(5);
    // 8 x 60 x 0.25 = 120 TRIMP, about a hard hour.
    expect(withLog.strain).toBeCloseTo(13.3, 0);
    const a = withLog.activities[0]!;
    expect(a.workout?.title).toBe("Leg day");
    expect(a.effortStrain).toBeGreaterThan(7);
  });

  it("never lowers strain when heart rate already showed more", () => {
    const easy = { ...lift, effort: 3 };
    const hard = steady(165, 60);
    expect(computeStrain(hard, 60, profile, [easy]).strain).toBe(computeStrain(hard, 60, profile).strain);
  });

  it("makes a logged workout its own activity when heart rate saw nothing", () => {
    const r = computeStrain(steady(70, 30, 120 * MIN), 60, profile, [lift]);
    expect(r.activities).toHaveLength(1);
    expect(r.activities[0]!.workout?.id).toBe("w1");
    expect(r.activities[0]!.strain + r.everydayStrain).toBeCloseTo(r.strain, 5);
  });

  it("ignores a workout without an effort rating, but still labels the matching activity", () => {
    const r = computeStrain(steady(156, 60), 60, profile, [{ ...lift, effort: undefined }]);
    expect(r.strain).toBe(computeStrain(steady(156, 60), 60, profile).strain);
    expect(r.activities[0]!.workout?.title).toBe("Leg day");
    expect(r.activities[0]!.effortStrain).toBeUndefined();
  });
});

describe("active zone minutes", () => {
  it("counts fat burn once and cardio or peak twice", () => {
    // Resting 60, max 188: fat burn from 111, cardio from 137, peak from 169.
    const samples = [...steady(120, 30), ...steady(150, 20, 31 * MIN), ...steady(175, 10, 52 * MIN)];
    const z = activeZoneMinutes(samples, 60, profile);
    // The minute between two stretches counts at the earlier one's rate.
    expect(z.fatBurn).toBe(31);
    expect(z.cardio).toBe(21);
    expect(z.peak).toBe(10);
    expect(z.total).toBe(31 + 2 * 31);
  });

  it("tracks the weekly goal over the last 7 days", () => {
    expect(weeklyZoneProgress([100, 10, 10, 10, 10, 10, 10, 10])).toEqual({ minutes: 70, progress: 0.47 });
  });
});

describe("breathing rate in recovery", () => {
  const history: NightMetrics[] = Array.from({ length: 10 }, () => ({ hrvRmssd: 55, restingHr: 58, respiratoryRate: 14 }));

  it("lowers recovery when breathing is faster than usual", () => {
    const calm = computeRecovery({ today: { hrvRmssd: 55, restingHr: 58, respiratoryRate: 14 }, history });
    const fast = computeRecovery({ today: { hrvRmssd: 55, restingHr: 58, respiratoryRate: 16 }, history });
    expect(fast.score!).toBeLessThan(calm.score!);
    expect(fast.breakdown!.factors.map((f) => f.key)).toContain("respiratoryRate");
  });

  it("leaves it out until there are enough nights to compare with", () => {
    const short = history.slice(0, 2).concat(history.slice(0, 3).map((h) => ({ hrvRmssd: h.hrvRmssd, restingHr: h.restingHr })));
    const r = computeRecovery({ today: { hrvRmssd: 55, restingHr: 58, respiratoryRate: 16 }, history: short });
    expect(r.breakdown!.factors.map((f) => f.key)).not.toContain("respiratoryRate");
  });
});
