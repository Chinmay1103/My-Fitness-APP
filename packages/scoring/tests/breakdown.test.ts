import { describe, expect, it } from "vitest";
import { computeDailyScores, computeStrain, generateMockDays, MOCK_PROFILE } from "../src";
import { roundToTotal } from "../src/stats";

const scores = computeDailyScores(generateMockDays({ endDate: "2026-09-30" }), MOCK_PROFILE);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("roundToTotal", () => {
  it("rounds values so they add up to the total", () => {
    expect(roundToTotal([3.4, 3.4, 3.2], 10)).toEqual([4, 3, 3]);
    expect(sum(roundToTotal([1.26, 2.26, 0.26], 3.8, 1))).toBeCloseTo(3.8);
    expect(sum(roundToTotal([-2.6, 5.4], 3))).toBe(3);
  });
});

describe("score breakdowns add up to the score", () => {
  it("recovery: typical plus factor points", () => {
    const scored = scores.filter((s) => s.recovery?.breakdown);
    expect(scored.length).toBeGreaterThan(30);
    for (const { recovery } of scored) {
      const { typical, factors } = recovery!.breakdown!;
      expect(typical + sum(factors.map((f) => f.points))).toBe(recovery!.score);
    }
  });

  it("sleep: ceiling minus quality penalties, and need parts add up", () => {
    for (const { sleep, sleepNeed } of scores) {
      const { ceiling, penalties } = sleep!.breakdown;
      expect(ceiling - penalties.efficiency - penalties.restorative - penalties.consistency).toBe(sleep!.score);
      expect(Object.values(penalties).every((p) => p >= 0)).toBe(true);
      expect(sleepNeed!.base + sleepNeed!.strain + sleepNeed!.debt).toBe(sleepNeed!.total);
      expect(sleepNeed!.total).toBe(sleep!.needMinutes);
    }
  });

  it("strain: activities plus everyday strain", () => {
    for (const { strain } of scores) {
      expect(sum([...strain.activities.map((a) => a.strain), strain.everydayStrain])).toBeCloseTo(strain.strain, 5);
    }
  });
});

describe("strain activities", () => {
  const start = Date.parse("2026-09-30T18:00:00Z");
  const minute = 60_000;
  const profile = { age: 30 }; // max HR 187

  it("finds a workout and ignores short bursts", () => {
    const samples = [
      ...Array.from({ length: 41 }, (_, m) => ({ time: start + m * minute, bpm: 160 })),
      { time: start + 41 * minute, bpm: 70 },
      // A 3-minute burst an hour later.
      ...Array.from({ length: 4 }, (_, m) => ({ time: start + (100 + m) * minute, bpm: 150 })),
      { time: start + 104 * minute, bpm: 70 },
    ];
    const result = computeStrain(samples, 60, profile);
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0]!.minutes).toBe(41);
    expect(result.activities[0]!.avgBpm).toBe(160);
    expect(result.everydayStrain).toBeGreaterThan(0);
    expect(result.activities[0]!.strain).toBeGreaterThan(result.everydayStrain * 5);
  });

  it("merges an effort split by a short pause", () => {
    const hr = (m: number) => (m >= 20 && m < 25 ? 70 : 150);
    const samples = Array.from({ length: 50 }, (_, m) => ({ time: start + m * minute, bpm: hr(m) }));
    expect(computeStrain(samples, 60, profile).activities).toHaveLength(1);
  });
});
