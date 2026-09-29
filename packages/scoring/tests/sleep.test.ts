import { describe, expect, it } from "vitest";
import { computeSleepScore, sleepNeedMinutes, type SleepSession } from "../src";

const HOUR = 3_600_000;
const night = (asleepMin: number, awakeMin = 20, start = 23 * HOUR): SleepSession => ({
  start,
  end: start + (asleepMin + awakeMin) * 60_000,
  stages: { awake: awakeMin, light: asleepMin * 0.6, deep: asleepMin * 0.18, rem: asleepMin * 0.22 },
});

describe("sleep need", () => {
  it("defaults to 8 hours", () => {
    expect(sleepNeedMinutes()).toBe(480);
  });

  it("adds time after a high-strain day", () => {
    expect(sleepNeedMinutes({ priorDayStrain: 18 })).toBe(505);
  });

  it("adds a third of recent sleep debt, capped at an hour", () => {
    expect(sleepNeedMinutes({ recentShortfalls: [30, 30, 30] })).toBe(510);
    expect(sleepNeedMinutes({ recentShortfalls: [300, 300, 300] })).toBe(540);
    expect(sleepNeedMinutes({ recentShortfalls: [-60, -60, -60] })).toBe(480);
  });
});

describe("sleep score", () => {
  it("gives a full, efficient, regular night a top score", () => {
    const result = computeSleepScore(night(480, 20), 480, [23 * HOUR - 86_400_000]);
    expect(result.score).toBe(100);
  });

  it("drops when sleeping well short of need", () => {
    const full = computeSleepScore(night(480), 480).score;
    const short = computeSleepScore(night(300), 480).score;
    expect(short).toBeLessThan(full - 20);
  });

  it("never rewards a short high-quality night over a full poor one", () => {
    const shortGood = computeSleepScore(night(360, 5), 480).score;
    const fullPoor = { ...night(480, 90), stages: { awake: 90, light: 430, deep: 25, rem: 25 } };
    expect(computeSleepScore(fullPoor, 480).score).toBeGreaterThan(shortGood);
  });

  it("penalises an irregular bedtime across midnight correctly", () => {
    // Previous bedtime 23:30, tonight 00:30: one hour apart, not 23 hours.
    const prior = 23.5 * HOUR - 86_400_000;
    const result = computeSleepScore(night(480, 20, 0.5 * HOUR), 480, [prior]);
    expect(result.consistency).toBe(0.5);
  });
});
