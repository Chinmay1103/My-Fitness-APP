import type { DayData, HeartRateSample, SleepSegment, SleepStageMinutes, UserProfile } from "./types";

/**
 * Realistic fake data so we can build and test before the Fitbit Air arrives.
 * Seeded, so the same seed always produces the same days.
 */

export const MOCK_PROFILE: UserProfile = { age: 28, baseSleepNeedMinutes: 480 };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function localDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Load = "rest" | "moderate" | "hard";

const WORKOUT: Record<Load, { minutes: number; effort: number }> = {
  rest: { minutes: 0, effort: 0 },
  moderate: { minutes: 45, effort: 0.6 },
  hard: { minutes: 70, effort: 0.78 },
};

/** Splits `total` whole minutes by `weights`, so the parts always add back up to `total`. */
function split(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const parts = weights.map((w) => Math.floor((total * w) / sum));
  let left = total - parts.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0; i = (i + 1) % parts.length, left--) parts[i] = (parts[i] ?? 0) + 1;
  return parts;
}

/**
 * A believable night, stage by stage, that adds up exactly to `stages`: roughly 90-minute cycles of
 * light → deep → light → REM, with most deep sleep early and REM growing towards morning, a few
 * minutes awake falling asleep and short wake-ups between cycles. Uses no randomness, so adding it
 * didn't change any other mock numbers.
 */
function mockSegments(start: number, stages: SleepStageMinutes): SleepSegment[] {
  const asleep = stages.light + stages.deep + stages.rem;
  const cycles = Math.max(3, Math.round(asleep / 90));
  const index = Array.from({ length: cycles }, (_, i) => i);
  const deep = split(stages.deep, index.map((i) => Math.max(0, 4 - i)));
  const rem = split(stages.rem, index.map((i) => i + 1));
  const light = split(stages.light, index.map(() => 1));
  // A third of the awake time is falling asleep; the rest is brief wake-ups between cycles.
  const [latency = 0, ...wakeups] = split(stages.awake, [cycles - 1, ...index.slice(1).map(() => 2)]);

  const segments: SleepSegment[] = [];
  let t = start;
  const add = (stage: SleepSegment["stage"], minutes: number) => {
    if (minutes <= 0) return;
    segments.push({ start: t, end: t + minutes * MINUTE, stage });
    t += minutes * MINUTE;
  };
  add("awake", latency);
  for (const i of index) {
    const [lightA = 0, lightB = 0] = split(light[i] ?? 0, [3, 2]);
    add("light", lightA);
    add("deep", deep[i] ?? 0);
    add("light", lightB);
    add("rem", rem[i] ?? 0);
    if (i > 0) add("awake", wakeups[i - 1] ?? 0);
  }
  return segments;
}

export interface MockOptions {
  days?: number;
  seed?: number;
  /** The last generated day, YYYY-MM-DD. Defaults to today. Times are in the local time zone. */
  endDate?: string;
}

export function generateMockDays(options: MockOptions = {}): DayData[] {
  const { days = 45, seed = 42 } = options;
  const rand = mulberry32(seed);
  const noise = (scale: number) => (rand() + rand() + rand() - 1.5) * scale;

  const [year, month, dayOfMonth] = (options.endDate ?? localDate(Date.now())).split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const baseRhr = 58;
  const baseHrv = 55;
  const maxHr = Math.round(208 - 0.7 * MOCK_PROFILE.age);

  const result: DayData[] = [];
  let prevLoad: Load = "rest";

  for (let d = days - 1; d >= 0; d--) {
    // Local midnight, so a workout at "18:00" shows as 6 PM wherever you are.
    const midnight = new Date(year, month - 1, dayOfMonth - d).getTime();

    // Last night's sleep: a hard day before means a bit more sleep but worse HRV.
    const sleepStart = midnight - HOUR + noise(40 * MINUTE);
    const asleep = Math.round(455 + noise(70) + (prevLoad === "hard" ? 15 : 0));
    const awake = Math.round(25 + Math.abs(noise(20)));
    const deep = Math.round(asleep * (0.17 + noise(0.04)));
    const rem = Math.round(asleep * (0.22 + noise(0.05)));
    const stages = { awake, light: asleep - deep - rem, deep, rem };
    const sleep = {
      start: sleepStart,
      end: sleepStart + (asleep + awake) * MINUTE,
      stages,
      segments: mockSegments(sleepStart, stages),
    };

    const loadEffect = prevLoad === "hard" ? 1 : prevLoad === "moderate" ? 0.3 : -0.4;
    const sleepEffect = (asleep - 450) / 60;
    const hrvRmssd = Math.round(baseHrv * Math.exp(-0.1 * loadEffect + 0.05 * sleepEffect + noise(0.15)));
    const restingHr = Math.round(baseRhr + 2 * loadEffect - 0.8 * sleepEffect + noise(2.5));

    // Daytime heart rate: a sample every 5 minutes, every minute during a workout.
    const r = rand();
    const load: Load = r < 0.3 ? "rest" : r < 0.75 ? "moderate" : "hard";
    const heartRate: HeartRateSample[] = [];
    for (let t = midnight + 7 * HOUR; t < midnight + 23 * HOUR; t += 5 * MINUTE) {
      heartRate.push({ time: t, bpm: Math.round(restingHr + 18 + noise(16)) });
    }
    // Everyday walking, so rest days still carry a little strain.
    const walkStart = midnight + 9 * HOUR;
    const walkMinutes = Math.round(50 + noise(30));
    for (let m = 0; m < walkMinutes; m++) {
      heartRate.push({
        time: walkStart + m * MINUTE,
        bpm: Math.round(restingHr + (0.43 + noise(0.06)) * (maxHr - restingHr)),
      });
    }
    const workout = WORKOUT[load];
    const workoutStart = midnight + 18 * HOUR;
    for (let m = 0; m < workout.minutes; m++) {
      const effort = workout.effort + noise(0.08);
      heartRate.push({
        time: workoutStart + m * MINUTE,
        bpm: Math.round(restingHr + effort * (maxHr - restingHr)),
      });
    }
    heartRate.sort((a, b) => a.time - b.time);

    result.push({
      date: localDate(midnight),
      heartRate,
      sleep,
      restingHr,
      hrvRmssd,
    });
    prevLoad = load;
  }

  return result;
}
