import { describe, expect, it } from "vitest";
import { computeRecovery, recoveryZone, type NightMetrics } from "../src";

const history = (n: number): NightMetrics[] =>
  Array.from({ length: n }, (_, i) => ({ hrvRmssd: 55 + (i % 3) - 1, restingHr: 58 + (i % 2) }));

describe("recovery", () => {
  it("waits for 4 days of history", () => {
    const result = computeRecovery({ today: { hrvRmssd: 55, restingHr: 58 }, history: history(3) });
    expect(result.score).toBeNull();
    expect(result.calibrating).toBe(true);
  });

  it("flags scores as calibrating until 14 days", () => {
    const today = { hrvRmssd: 55, restingHr: 58 };
    expect(computeRecovery({ today, history: history(10) }).calibrating).toBe(true);
    expect(computeRecovery({ today, history: history(14) }).calibrating).toBe(false);
  });

  it("scores a typical night in the middle", () => {
    const result = computeRecovery({ today: { hrvRmssd: 55, restingHr: 58 }, history: history(20) });
    expect(result.score).toBeGreaterThan(45);
    expect(result.score).toBeLessThan(70);
  });

  it("rewards high HRV and low resting HR, penalises the opposite", () => {
    const good = computeRecovery({ today: { hrvRmssd: 70, restingHr: 54 }, history: history(20) });
    const bad = computeRecovery({ today: { hrvRmssd: 38, restingHr: 66 }, history: history(20) });
    expect(good.zone).toBe("green");
    expect(bad.zone).toBe("red");
  });

  it("stays within 5-95 even for absurd readings", () => {
    const high = computeRecovery({ today: { hrvRmssd: 500, restingHr: 30 }, history: history(20) });
    const low = computeRecovery({ today: { hrvRmssd: 5, restingHr: 120 }, history: history(20) });
    expect(high.score).toBeLessThanOrEqual(95);
    expect(low.score).toBeGreaterThanOrEqual(5);
  });

  it("maps zones like Whoop", () => {
    expect(recoveryZone(67)).toBe("green");
    expect(recoveryZone(66)).toBe("yellow");
    expect(recoveryZone(33)).toBe("red");
  });
});
