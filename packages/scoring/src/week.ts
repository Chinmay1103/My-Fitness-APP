import type { DailyScores } from "./daily";
import { trainingLoad, type LoadZone } from "./load";
import { round } from "./stats";

/**
 * A week in numbers, for the weekly report: averages, the best and worst mornings, sleep debt
 * built up, and the training load at the end of the week, plus one thing to focus on next week,
 * picked by simple rules so it always matches the numbers.
 */

export interface WeekSummary {
  /** First and last day, YYYY-MM-DD. */
  start: string;
  end: string;
  days: number;
  recovery: number | null;
  sleep: number | null;
  strain: number;
  /** Average time asleep, minutes. */
  asleep: number | null;
  best: { date: string; recovery: number } | null;
  worst: { date: string; recovery: number } | null;
  /** Minutes slept short of need, summed over the week (extra sleep doesn't cancel it out). */
  sleepDebt: number;
  greenDays: number;
  redDays: number;
  loadRatio: number | null;
  loadZone: LoadZone | null;
  focus: { title: string; detail: string };
}

/** The 7 days ending at `endIndex` (default: the latest). */
export function weekSummary(scores: DailyScores[], endIndex: number = scores.length - 1): WeekSummary | null {
  const week = scores.slice(Math.max(0, endIndex - 6), endIndex + 1);
  if (!week.length) return null;
  const avg = (v: number[]) => (v.length ? round(v.reduce((a, b) => a + b, 0) / v.length) : null);
  const recoveries = week.flatMap((s) => (s.recovery?.score != null ? [{ date: s.date, recovery: s.recovery.score }] : []));
  const sorted = [...recoveries].sort((a, b) => b.recovery - a.recovery);
  const load = trainingLoad(scores.slice(0, endIndex + 1)).at(-1);
  const summary = {
    start: week[0]!.date,
    end: week.at(-1)!.date,
    days: week.length,
    recovery: avg(recoveries.map((r) => r.recovery)),
    sleep: avg(week.flatMap((s) => (s.sleep ? [s.sleep.score] : []))),
    strain: round(week.reduce((a, s) => a + s.strain.strain, 0) / week.length, 1),
    asleep: avg(week.flatMap((s) => (s.sleep ? [s.sleep.asleepMinutes] : []))),
    best: sorted[0] ?? null,
    worst: sorted.at(-1) ?? null,
    sleepDebt: Math.round(week.reduce((sum, s) => sum + (s.sleep ? Math.max(0, s.sleep.needMinutes - s.sleep.asleepMinutes) : 0), 0)),
    greenDays: week.filter((s) => s.recovery?.zone === "green").length,
    redDays: week.filter((s) => s.recovery?.zone === "red").length,
    loadRatio: load?.ratio ?? null,
    loadZone: load?.zone ?? null,
  };
  return { ...summary, focus: weekFocus(summary) };
}

function weekFocus(w: Omit<WeekSummary, "focus">): { title: string; detail: string } {
  if (w.loadZone === "overreaching") {
    return { title: "Ease off the training", detail: "This week's load was well above what you're used to. Two or three easier days let fitness catch up." };
  }
  if (w.sleepDebt >= 180) {
    return {
      title: "Win back sleep",
      detail: `You ran ${Math.round(w.sleepDebt / 60)} hours short of your need this week. Aim for 30 minutes earlier to bed on most nights.`,
    };
  }
  if (w.redDays >= 2) {
    return { title: "Protect recovery", detail: `${w.redDays} red mornings this week. Look at what came before them: late meals, drinks, hard days back to back.` };
  }
  if (w.loadZone === "fresh" && (w.recovery ?? 0) >= 60) {
    return { title: "Room to push", detail: "Recovery held up and load dropped below your usual. A harder session or two would build fitness." };
  }
  return { title: "Keep the rhythm", detail: "Steady week. Keep bedtime consistent and spread training through the week." };
}
