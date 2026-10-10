import { describe, expect, it } from "vitest";
import {
  bodyCheck,
  computeDailyScores,
  generateMockDays,
  habitImpact,
  learnSleepNeed,
  loadZone,
  MOCK_PROFILE,
  trainingLoad,
  weekSummary,
  type DailyScores,
  type DayData,
} from "../src";

const night = (date: string, restingHr: number, respiratoryRate: number, skinTempDelta?: number): DayData => ({
  date,
  heartRate: [],
  restingHr,
  respiratoryRate,
  skinTempDelta,
});
const usual = Array.from({ length: 14 }, (_, i) => night(`2026-09-${String(i + 1).padStart(2, "0")}`, 58 + (i % 3), 14.2 + (i % 2) * 0.3, (i % 3) * 0.1 - 0.1));

describe("body check", () => {
  it("stays normal on a usual night", () => {
    const r = bodyCheck([...usual, night("2026-09-15", 59, 14.4, 0)])!;
    expect(r.level).toBe("normal");
    expect(r.signals).toHaveLength(3);
  });

  it("alerts when temperature and breathing rise together", () => {
    const r = bodyCheck([...usual, night("2026-09-15", 60, 16, 0.9)])!;
    expect(r.level).toBe("alert");
    expect(r.signals.filter((s) => s.raised).map((s) => s.key).sort()).toEqual(["breathing", "skinTemp"]);
  });

  it("only watches when one signal is up", () => {
    expect(bodyCheck([...usual, night("2026-09-15", 66, 14.3, 0)])!.level).toBe("watch");
  });

  it("waits for a week of nights before comparing", () => {
    expect(bodyCheck([...usual.slice(0, 4), night("2026-09-15", 70, 18, 1)])).toBeNull();
  });
});

const days = generateMockDays({ days: 45, endDate: "2026-10-10" });
const scores = computeDailyScores(days, MOCK_PROFILE);

describe("training load", () => {
  it("compares the last week with the last four", () => {
    const load = trainingLoad(scores);
    expect(load[5]!.ratio).toBeNull();
    const last = load.at(-1)!;
    expect(last.ratio).toBeGreaterThan(0.5);
    expect(last.ratio).toBeLessThan(1.6);
  });

  it("names the zones", () => {
    expect([0.6, 1, 1.4, 1.8].map(loadZone)).toEqual(["fresh", "steady", "building", "overreaching"]);
  });
});

describe("learned sleep need", () => {
  it("needs two weeks of nights", () => {
    expect(learnSleepNeed(scores.slice(0, 10))).toBeNull();
  });

  it("lands in a sensible range on demo data", () => {
    const learned = learnSleepNeed(scores)!;
    expect(learned.minutes).toBeGreaterThanOrEqual(390);
    expect(learned.minutes).toBeLessThanOrEqual(570);
    expect(learned.minutes % 5).toBe(0);
  });

  it("moves towards what the best nights had", () => {
    // Every best night was 9 h: the learned need goes above 8 h, but not all the way at first.
    const fake = Array.from({ length: 21 }, (_, i): DailyScores => ({
      date: `d${i}`,
      strain: { strain: 5, trimp: 10, zoneMinutes: [0, 0, 0, 0, 0], activities: [], everydayStrain: 5 },
      sleep: { score: 80, asleepMinutes: i % 3 === 0 ? 540 : 420, needMinutes: 480, efficiency: 0.9, restorativeRatio: 0.4, consistency: 1, breakdown: { ceiling: 90, penalties: { efficiency: 0, restorative: 0, consistency: 0 } } },
      sleepNeed: { base: 480, strain: 0, debt: 0, total: 480 },
      recovery: { score: i % 3 === 0 ? 85 : 50, zone: "green", calibrating: false, daysOfHistory: 20, hrvZ: 0, restingHrZ: 0, breakdown: null },
    }));
    const learned = learnSleepNeed(fake)!;
    expect(learned.bestNights).toBe(540);
    expect(learned.minutes).toBeGreaterThan(480);
    expect(learned.minutes).toBeLessThan(540);
  });
});

describe("habit impact", () => {
  it("compares the morning after with other mornings", () => {
    const habitDays = scores.filter((_, i) => i % 5 === 0).map((s) => ({ kind: "alcohol", date: s.date }));
    const [impact] = habitImpact(habitDays, scores);
    expect(impact!.kind).toBe("alcohol");
    expect(impact!.daysWith).toBeGreaterThanOrEqual(3);
    expect(impact!.recoveryDiff).not.toBeNull();
  });

  it("holds back until there are 3 days with the habit", () => {
    const [impact] = habitImpact([{ kind: "sauna", date: scores[10]!.date }], scores);
    expect(impact!.recoveryDiff).toBeNull();
  });
});

describe("week summary", () => {
  it("sums up the last 7 days with a focus", () => {
    const w = weekSummary(scores)!;
    expect(w.days).toBe(7);
    expect(w.end).toBe("2026-10-10");
    expect(w.best!.recovery).toBeGreaterThanOrEqual(w.worst!.recovery);
    expect(w.focus.title.length).toBeGreaterThan(0);
  });
});
