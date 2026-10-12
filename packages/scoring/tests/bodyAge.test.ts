import { describe, expect, it } from "vitest";
import {
  computeBodyAge,
  computeDailyScores,
  estimateVo2max,
  generateMockDays,
  MOCK_PROFILE,
  typicalVo2max,
} from "../src";

const days = generateMockDays({ days: 45, endDate: "2026-10-10" });
const scores = computeDailyScores(days, MOCK_PROFILE);
const workouts = days.flatMap((d) => d.workouts ?? []);
const profile = { ...MOCK_PROFILE, ageKnown: true, sex: "male" as const, heightCm: 175, weightKg: 70 };

describe("body age", () => {
  it("needs two weeks of band data", () => {
    expect(computeBodyAge({ days: days.slice(0, 10), scores: scores.slice(0, 10), workouts, profile })).toBeNull();
  });

  it("factors add up exactly to the difference from your age", () => {
    const b = computeBodyAge({ days, scores, workouts, profile })!;
    const sum = b.factors.reduce((a, f) => a + f.years, 0);
    expect(sum).toBeCloseTo(b.delta, 5);
    expect(b.bodyAge).toBeCloseTo(28 + b.delta, 5);
    expect(b.factors.map((f) => f.key)).toContain("bmi");
    expect(b.missing).toEqual([]);
  });

  it("makes the very active demo person younger, within the caps", () => {
    // 12k steps a day, ~400 active minutes a week, gym 3 times: younger, but not absurdly.
    const b = computeBodyAge({ days, scores, workouts, profile })!;
    expect(b.delta).toBeLessThan(-3);
    expect(b.delta).toBeGreaterThanOrEqual(-10);
    for (const f of b.factors) expect(Math.abs(f.years)).toBeLessThanOrEqual(3);
  });

  it("gives no body age, only the difference, without a birth date; lists what's missing", () => {
    const b = computeBodyAge({ days, scores, workouts, profile: { ...MOCK_PROFILE } })!;
    expect(b.age).toBeNull();
    expect(b.bodyAge).toBeNull();
    expect(b.missing.map((m) => m.key)).toContain("bmi");
  });

  it("a lower resting heart rate makes you younger", () => {
    const calm = days.map((d) => (d.restingHr ? { ...d, restingHr: d.restingHr - 8 } : d));
    const a = computeBodyAge({ days, scores, workouts, profile })!;
    const b = computeBodyAge({ days: calm, scores, workouts, profile })!;
    expect(b.delta).toBeLessThan(a.delta);
  });
});

describe("VO2max", () => {
  it("estimates from heart rate and compares with age norms", () => {
    expect(estimateVo2max(188, 60)).toBeCloseTo(47.9, 1);
    expect(typicalVo2max(25, "male")).toBe(48);
    expect(typicalVo2max(45, "female")).toBeLessThan(typicalVo2max(25, "female"));
  });
});
