import { describe, expect, it } from "vitest";
import { sustainedAbove, type HeartRateSample } from "../src";

/** One reading a second, starting at time 0. */
const perSecond = (bpms: number[]): HeartRateSample[] => bpms.map((bpm, i) => ({ time: i * 1000, bpm }));
const TWO_MIN = 120_000;

describe("sustainedAbove", () => {
  it("fires once heart rate has stayed above the limit for the whole period", () => {
    expect(sustainedAbove(perSecond(Array(121).fill(120)), 115, TWO_MIN)).toBe(120);
  });

  it("does not fire before the period is over", () => {
    expect(sustainedAbove(perSecond(Array(119).fill(120)), 115, TWO_MIN)).toBeNull();
  });

  it("starts over when heart rate dips below the limit", () => {
    const bpms = [...Array(100).fill(120), 100, ...Array(60).fill(120)];
    expect(sustainedAbove(perSecond(bpms), 115, TWO_MIN)).toBeNull();
  });

  it("does not bridge a long gap in readings", () => {
    const samples = [
      ...perSecond(Array(60).fill(120)),
      ...perSecond(Array(70).fill(120)).map((s) => ({ ...s, time: s.time + 120_000 })),
    ];
    expect(sustainedAbove(samples, 115, TWO_MIN)).toBeNull();
  });

  it("does not fire when the latest reading is below the limit", () => {
    expect(sustainedAbove(perSecond([...Array(200).fill(130), 90]), 115, TWO_MIN)).toBeNull();
  });
});
