import { clamp, round } from "./stats";
import type { SleepSession, Timestamp } from "./types";

const DEFAULT_SLEEP_NEED_MINUTES = 480;
/** Share of deep + REM sleep we treat as fully restorative. */
const RESTORATIVE_TARGET = 0.4;
const MAX_DEBT_MINUTES = 60;

export interface SleepNeedInput {
  baseNeedMinutes?: number;
  /** Strain of the day before this sleep. */
  priorDayStrain?: number;
  /** How far short of need each of the last few nights fell, in minutes. */
  recentShortfalls?: number[];
}

export function sleepNeedMinutes(input: SleepNeedInput = {}): number {
  const base = input.baseNeedMinutes ?? DEFAULT_SLEEP_NEED_MINUTES;
  const strainExtra = Math.max(0, (input.priorDayStrain ?? 0) - 8) * 2.5;
  const shortfalls = (input.recentShortfalls ?? []).slice(-3);
  const debt = Math.min(
    shortfalls.reduce((sum, s) => sum + Math.max(0, s), 0) / 3,
    MAX_DEBT_MINUTES,
  );
  return Math.round(base + strainExtra + debt);
}

export function asleepMinutes(session: SleepSession): number {
  const { light, deep, rem } = session.stages;
  return light + deep + rem;
}

/** Shortest distance between two times of day, in minutes (handles midnight wraparound). */
function timeOfDayDistance(a: Timestamp, b: Timestamp): number {
  const day = 1440;
  const diff = (((a - b) / 60_000) % day + day) % day;
  return Math.min(diff, day - diff);
}

export interface SleepScoreResult {
  /** 0 to 100. */
  score: number;
  asleepMinutes: number;
  needMinutes: number;
  efficiency: number;
  restorativeRatio: number;
  consistency: number;
}

export function computeSleepScore(
  session: SleepSession,
  needMinutes: number,
  /** Start times of previous sleeps, for bedtime consistency. */
  priorStarts: Timestamp[] = [],
): SleepScoreResult {
  const asleep = asleepMinutes(session);
  const inBed = Math.max((session.end - session.start) / 60_000, asleep, 1);
  const efficiency = asleep / inBed;
  const restorativeRatio = asleep > 0 ? (session.stages.deep + session.stages.rem) / asleep : 0;

  const recent = priorStarts.slice(-7);
  const avgDrift =
    recent.length > 0
      ? recent.reduce((sum, t) => sum + timeOfDayDistance(session.start, t), 0) / recent.length
      : 0;
  const consistency = 1 - clamp(avgDrift / 120, 0, 1);

  // Hours vs. need sets the ceiling; poor quality can take up to 30% off it.
  // A great-quality short night can never score higher than a full one.
  const sufficiency = clamp(asleep / needMinutes, 0, 1);
  const quality =
    (clamp(efficiency / 0.95, 0, 1) + clamp(restorativeRatio / RESTORATIVE_TARGET, 0, 1) + consistency) /
    3;
  const score = sufficiency * (0.7 + 0.3 * quality);

  return {
    score: Math.round(score * 100),
    asleepMinutes: Math.round(asleep),
    needMinutes,
    efficiency: round(efficiency, 2),
    restorativeRatio: round(restorativeRatio, 2),
    consistency: round(consistency, 2),
  };
}
