import { describe, expect, it } from "vitest";
import { generateMockDays, heartRateZone, summarizeHeartRate } from "../src";

const at = (hour: number, minute = 0) => new Date(2026, 9, 3, hour, minute).getTime();

describe("heart rate summary", () => {
  it("returns null without samples", () => {
    expect(summarizeHeartRate([])).toBeNull();
  });

  it("averages per minute, so dense workout samples don't outweigh the rest of the day", () => {
    const samples = [
      { time: at(8), bpm: 60 },
      // One minute of 12 samples at 5-second intervals.
      ...Array.from({ length: 12 }, (_, i) => ({ time: at(18) + i * 5000, bpm: 150 })),
    ];
    const summary = summarizeHeartRate(samples)!;
    expect(summary.avg).toBe(105);
    expect(summary.low).toBe(60);
    expect(summary.high).toBe(150);
    expect(summary.minutesCovered).toBe(2);
    expect(summary.latest.time).toBe(at(18) + 11 * 5000);
  });

  it("buckets by local hour", () => {
    const summary = summarizeHeartRate([
      { time: at(7, 10), bpm: 70 },
      { time: at(7, 40), bpm: 80 },
      { time: at(22), bpm: 64 },
    ])!;
    expect(summary.hourly).toHaveLength(24);
    expect(summary.hourly[7]).toBe(75);
    expect(summary.hourly[22]).toBe(64);
    expect(summary.hourly[12]).toBeNull();
  });
});

describe("heart rate zone", () => {
  it("matches the strain zones: resting 60, max 188", () => {
    expect(heartRateZone(70, 60, 188)).toBe(-1);
    expect(heartRateZone(99, 60, 188)).toBe(0); // 30% of reserve
    expect(heartRateZone(156, 60, 188)).toBe(3); // 75%
    expect(heartRateZone(185, 60, 188)).toBe(4);
  });
});

describe("mock night heart rate", () => {
  it("stays near resting and only covers sleep after midnight", () => {
    for (const day of generateMockDays({ days: 10, endDate: "2026-10-03" })) {
      const night = day.sleepHeartRate!;
      expect(night.length).toBeGreaterThan(50);
      const midnight = new Date(`${day.date}T00:00:00`).getTime();
      for (const s of night) {
        expect(s.time).toBeGreaterThanOrEqual(midnight);
        expect(s.bpm).toBeGreaterThan(day.restingHr! - 4);
        expect(s.bpm).toBeLessThan(day.restingHr! + 12);
      }
    }
  });
});
