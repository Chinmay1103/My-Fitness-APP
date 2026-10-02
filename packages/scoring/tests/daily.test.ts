import { describe, expect, it } from "vitest";
import { MOCK_PROFILE, computeDailyScores, generateMockDays } from "../src";

describe("daily scores on mock data", () => {
  const days = generateMockDays({ days: 45, seed: 7, endDate: "2026-09-29" });
  const scores = computeDailyScores(days, MOCK_PROFILE);

  it("generates the same data for the same seed", () => {
    expect(generateMockDays({ days: 45, seed: 7, endDate: "2026-09-29" })).toEqual(days);
    expect(days.at(-1)!.date).toBe("2026-09-29");
  });

  it("scores every day with values in range", () => {
    expect(scores).toHaveLength(45);
    for (const s of scores) {
      expect(s.strain.strain).toBeGreaterThanOrEqual(0);
      expect(s.strain.strain).toBeLessThanOrEqual(21);
      expect(s.sleep!.score).toBeGreaterThanOrEqual(0);
      expect(s.sleep!.score).toBeLessThanOrEqual(100);
    }
  });

  it("starts calibrating, then produces recovery scores", () => {
    expect(scores.slice(0, 4).every((s) => s.recovery!.score === null)).toBe(true);
    expect(scores.slice(14).every((s) => !s.recovery!.calibrating)).toBe(true);
  });

  it("does not swing to extremes too often", () => {
    const recoveries = scores.slice(14).map((s) => s.recovery!.score!);
    const extreme = recoveries.filter((r) => r < 15 || r > 90).length;
    expect(extreme / recoveries.length).toBeLessThan(0.15);
  });

  it("does not let sleep debt ratchet the need up to the cap", () => {
    const needs = scores.map((s) => s.sleep!.needMinutes);
    expect(needs.filter((n) => n >= 540).length).toBeLessThan(needs.length / 4);
  });

  it("separates rest days from hard days on strain", () => {
    const strains = scores.map((s) => s.strain.strain);
    expect(Math.min(...strains)).toBeLessThan(6);
    expect(Math.max(...strains)).toBeGreaterThan(12);
  });
});

describe("mock sleep segments", () => {
  it("run back to back in time order and add up to the stage totals", () => {
    for (const day of generateMockDays({ days: 20, endDate: "2026-09-30" })) {
      const sleep = day.sleep!;
      const segs = sleep.segments!;
      expect(segs[0]!.start).toBe(sleep.start);
      expect(segs.at(-1)!.end).toBe(sleep.end);
      for (let i = 1; i < segs.length; i++) expect(segs[i]!.start).toBe(segs[i - 1]!.end);
      const totals = { awake: 0, light: 0, deep: 0, rem: 0 };
      for (const s of segs) totals[s.stage] += (s.end - s.start) / 60_000;
      expect(totals).toEqual(sleep.stages);
    }
  });
});
