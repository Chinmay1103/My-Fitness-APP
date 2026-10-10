import type { StepRecord } from "./steps";

/** Epoch milliseconds. */
export type Timestamp = number;

export interface HeartRateSample {
  time: Timestamp;
  bpm: number;
}

/** Minutes spent in each sleep stage during one sleep session. */
export interface SleepStageMinutes {
  awake: number;
  light: number;
  deep: number;
  rem: number;
}

export type SleepStage = keyof SleepStageMinutes;

/** One stretch of a single stage, e.g. 01:40–02:05 deep. */
export interface SleepSegment {
  start: Timestamp;
  end: Timestamp;
  stage: SleepStage;
}

export interface SleepSession {
  start: Timestamp;
  end: Timestamp;
  stages: SleepStageMinutes;
  /** The night stage by stage, in time order, when the band recorded it. Only drawn, never scored. */
  segments?: SleepSegment[];
}

export interface UserProfile {
  age: number;
  /** Measured max heart rate. Estimated from age when missing. */
  maxHr?: number;
  /** Baseline sleep need before strain and debt adjustments. Defaults to 8h. */
  baseSleepNeedMinutes?: number;
}

/** A workout the user told the coach about (from the `workouts` table). */
export interface LoggedWorkout {
  id: string;
  start: Timestamp;
  end: Timestamp;
  /** e.g. 'strength', 'run', 'walk'. */
  kind: string;
  title?: string;
  /** How hard it felt, 1 (very easy) to 10 (all out). Without it the workout can't add strain. */
  effort?: number;
}

/**
 * Everything we know about one calendar day.
 * `sleep`, `restingHr` and `hrvRmssd` describe the night that ended on the morning of `date`;
 * `heartRate` covers the waking day; `sleepHeartRate` the part of the main sleep after midnight.
 * Together they are the whole calendar day.
 */
export interface DayData {
  date: string; // YYYY-MM-DD
  heartRate: HeartRateSample[];
  /** Heart rate during the main sleep. Only shown and summarized, never counted toward strain. */
  sleepHeartRate?: HeartRateSample[];
  sleep?: SleepSession;
  restingHr?: number;
  hrvRmssd?: number;
  /** Breaths per minute during last night's sleep. Optional recovery factor. */
  respiratoryRate?: number;
  /** Last night's skin temperature, °C above (+) or below (−) the band's own baseline. Body check only. */
  skinTempDelta?: number;
  /** Workouts logged through the coach that started this day. Can add strain heart rate missed. */
  workouts?: LoggedWorkout[];
  /** Step counts from the band and the phone, combined with `combineSteps`. Shown, not scored. */
  steps?: StepRecord[];
  /** Average blood oxygen during last night's sleep, %. Shown, not scored. */
  spo2?: number;
  /** Energy burned over the whole day, kcal, as the band's app estimates it. Shown, not scored. */
  caloriesBurned?: number;
}

/** Something the user told the coach they did that day: drinks, late coffee, a late meal... */
export interface HabitEntry {
  /** Short lowercase name the coach uses consistently, e.g. "alcohol", "late caffeine". */
  kind: string;
  /** Local date it happened, YYYY-MM-DD. */
  date: string;
  /** How much, when it matters (e.g. 2 drinks). */
  amount?: number;
}
