import { describe, expect, it } from "vitest";
import { combineSteps, type HeartRateSample, type StepRecord } from "../src";

const MIN = 60_000;
// Local 10:00 on some day, so windows line up with the 5-minute grid.
const T0 = new Date(2026, 9, 10, 10, 0).getTime();
const steps = (device: StepRecord["device"], fromMin: number, toMin: number, count: number): StepRecord => ({
  start: T0 + fromMin * MIN,
  end: T0 + toMin * MIN,
  count,
  device,
});
const hr = (bpm: number, fromMin: number, toMin: number): HeartRateSample[] =>
  Array.from({ length: toMin - fromMin }, (_, i) => ({ time: T0 + (fromMin + i) * MIN, bpm }));

describe("combineSteps", () => {
  it("keeps band steps the phone confirms", () => {
    const r = combineSteps([steps("band", 0, 10, 1000), steps("phone", 0, 10, 950)], hr(100, 0, 10), 60);
    expect(r.total).toBe(1000);
    expect(r.ghost).toBe(0);
  });

  it("caps the band when it runs far ahead of the phone", () => {
    const r = combineSteps([steps("band", 0, 5, 600), steps("phone", 0, 5, 200)], [], 60);
    expect(r.total).toBe(290); // 200 * 1.3 + 30
    expect(r.ghost).toBe(310);
  });

  it("drops band-only steps while heart rate stays flat (a scooter ride)", () => {
    const r = combineSteps([steps("band", 0, 20, 400)], hr(64, 0, 20), 60);
    expect(r.total).toBe(0);
    expect(r.ghost).toBe(400);
  });

  it("keeps band-only steps when heart rate rose, or the cadence was a real walk", () => {
    expect(combineSteps([steps("band", 0, 5, 150)], hr(75, 0, 5), 60).total).toBe(150);
    expect(combineSteps([steps("band", 0, 5, 450)], hr(62, 0, 5), 60).total).toBe(450);
  });

  it("keeps band-only steps with no heart rate to check against", () => {
    expect(combineSteps([steps("band", 0, 5, 120)], [], 60).total).toBe(120);
  });

  it("adds phone-only steps (band off the wrist)", () => {
    const r = combineSteps([steps("phone", 0, 10, 800)], [], 60);
    expect(r.total).toBe(800);
    expect(r.phoneOnly).toBe(800);
  });

  it("spreads a long record over its windows and sums by hour", () => {
    const r = combineSteps([steps("band", 0, 60, 6000), steps("phone", 0, 60, 6000)], [], 60);
    expect(r.total).toBe(6000);
    expect(r.hourly[10]).toBe(6000);
  });
});
