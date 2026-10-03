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
}
