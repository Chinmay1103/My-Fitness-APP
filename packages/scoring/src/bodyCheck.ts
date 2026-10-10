import { robustBaseline } from "./stats";
import type { DayData } from "./types";

/**
 * Body check: an early warning when several overnight signals rise together, the way they do at
 * the start of a cold or after overreaching. Each signal is compared with your own last 30 nights
 * (median, robust spread); one raised signal is a "watch", two or more an "alert". Wellness
 * guidance, not a diagnosis.
 */

export type BodySignalKey = "skinTemp" | "breathing" | "restingHr";

export interface BodySignal {
  key: BodySignalKey;
  today: number;
  /** Your usual: the median of the last 30 nights. */
  usual: number;
  /** today − usual, in the signal's unit (°C, breaths/min, bpm). */
  diff: number;
  raised: boolean;
}

export interface BodyCheck {
  /** normal: nothing raised; watch: one signal up; alert: two or more up together. */
  level: "normal" | "watch" | "alert";
  signals: BodySignal[];
  raisedCount: number;
}

/** How far above usual counts as raised: at least `min` in the signal's unit and `z` robust SDs. */
const RULES: Record<BodySignalKey, { min: number; z: number; spread: number; read: (d: DayData) => number | undefined }> = {
  skinTemp: { min: 0.5, z: 2, spread: 0.15, read: (d) => d.skinTempDelta },
  breathing: { min: 1, z: 2, spread: 0.3, read: (d) => d.respiratoryRate },
  restingHr: { min: 4, z: 2, spread: 1.5, read: (d) => d.restingHr },
};
const WINDOW = 30;
/** A signal needs this many earlier nights before it's compared. */
const MIN_NIGHTS = 7;

/** The body check for `days[index]`, or null when fewer than two signals can be compared yet. */
export function bodyCheck(days: DayData[], index: number = days.length - 1): BodyCheck | null {
  const today = days[index];
  if (!today) return null;
  const history = days.slice(Math.max(0, index - WINDOW), index);
  const signals: BodySignal[] = [];
  for (const key of Object.keys(RULES) as BodySignalKey[]) {
    const rule = RULES[key];
    const value = rule.read(today);
    const past = history.flatMap((d) => {
      const v = rule.read(d);
      return v === undefined ? [] : [v];
    });
    if (value === undefined || past.length < MIN_NIGHTS) continue;
    const base = robustBaseline(past, rule.spread)!;
    const diff = value - base.center;
    signals.push({
      key,
      today: Math.round(value * 10) / 10,
      usual: Math.round(base.center * 10) / 10,
      diff: Math.round(diff * 10) / 10,
      raised: diff >= rule.min && diff / base.spread >= rule.z,
    });
  }
  if (signals.length < 2) return null;
  const raisedCount = signals.filter((s) => s.raised).length;
  return { level: raisedCount >= 2 ? "alert" : raisedCount === 1 ? "watch" : "normal", signals, raisedCount };
}
