import { describe, expect, it } from "vitest";
import { computeStrain, estimateMaxHr, heartRateZone, strainFromTrimp, type HeartRateSample } from "../src";

const profile = { age: 28 }; // max HR 188
const steady = (bpm: number, minutes: number, stepMinutes = 1): HeartRateSample[] =>
  Array.from({ length: minutes / stepMinutes + 1 }, (_, i) => ({ time: i * stepMinutes * 60_000, bpm }));

describe("strain", () => {
  it("estimates max HR with the Tanaka formula", () => {
    expect(estimateMaxHr(profile)).toBe(188);
    expect(estimateMaxHr({ age: 28, maxHr: 195 })).toBe(195);
  });

  it("puts a reading in its heart-rate-reserve zone", () => {
    // Resting 60, max 188: zone 1 starts at 98 bpm, zone 4 at 150, zone 5 at 163.
    expect(heartRateZone(70, 60, 188)).toBe(0);
    expect(heartRateZone(98.4, 60, 188)).toBe(1);
    expect(heartRateZone(156, 60, 188)).toBe(4);
    expect(heartRateZone(200, 60, 188)).toBe(5);
  });

  it("scores a hard hour at 75% of heart-rate reserve around 13", () => {
    // Resting 60, max 188, so 75% of reserve is 156 bpm.
    const result = computeStrain(steady(156, 60), 60, profile);
    expect(result.trimp).toBeCloseTo(121.6, 0);
    expect(result.strain).toBe(13.4);
    expect(result.zoneMinutes).toEqual([0, 0, 0, 60, 0]);
  });

  it("ignores everyday low heart rate", () => {
    expect(computeStrain(steady(80, 600), 60, profile).strain).toBe(0);
  });

  it("does not count long gaps between samples as effort", () => {
    const gappy = [
      { time: 0, bpm: 170 },
      { time: 3 * 60 * 60_000, bpm: 170 },
    ];
    expect(computeStrain(gappy, 60, profile).zoneMinutes[4]).toBe(5);
  });

  it("never exceeds 21 and grows monotonically", () => {
    let last = -1;
    for (const trimp of [0, 20, 80, 150, 300, 1000, 10_000]) {
      const s = strainFromTrimp(trimp);
      expect(s).toBeGreaterThanOrEqual(last);
      expect(s).toBeLessThanOrEqual(21);
      last = s;
    }
  });

  it("handles unsorted samples", () => {
    const samples = steady(156, 30).reverse();
    expect(computeStrain(samples, 60, profile).zoneMinutes[3]).toBe(30);
  });
});
