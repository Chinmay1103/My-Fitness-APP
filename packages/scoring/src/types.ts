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

export interface SleepSession {
  start: Timestamp;
  end: Timestamp;
  stages: SleepStageMinutes;
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
 * `heartRate` covers the waking day.
 */
export interface DayData {
  date: string; // YYYY-MM-DD
  heartRate: HeartRateSample[];
  sleep?: SleepSession;
  restingHr?: number;
  hrvRmssd?: number;
}
