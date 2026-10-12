import type { DailyScores } from "./daily";
import { daySamples } from "./heartRate";
import { clamp, median, round, roundToTotal } from "./stats";
import { combineSteps } from "./steps";
import { estimateMaxHr } from "./strain";
import type { DayData, LoggedWorkout, Sex, UserProfile } from "./types";

/**
 * Body age, Whoop-Age style: how old your body behaves, from how you've lived the last 30 days.
 * Display only; never feeds a score.
 *
 * Each habit and signal has a published link to all-cause mortality (a hazard ratio, HR). Risk of
 * dying roughly doubles every 8 years of age (the Gompertz law), so a hazard ratio converts to
 * "years": years = 8 × log2(HR) ≈ 11.5 × ln(HR). The factors overlap (active people also have a lower
 * resting heart rate and a higher VO2max), so adding each study's full effect would count the same
 * thing several times: each one counts at half. Every factor is measured against a typical adult,
 * so a typical adult's body age equals their age, and the factors add up exactly to the
 * difference. Each factor is capped at ±3 years and the total at ±10, so one noisy reading can't
 * run away. A wellness estimate built on population studies, not a medical test.
 */

export type BodyAgeFactorKey =
  | "vo2max"
  | "restingHr"
  | "steps"
  | "moderate"
  | "vigorous"
  | "strength"
  | "sleepHours"
  | "sleepConsistency"
  | "bmi";

export interface BodyAgeFactor {
  key: BodyAgeFactorKey;
  /** Your 30-day value, in the factor's unit. */
  value: number;
  /** A typical adult's value: zero years. */
  typical: number;
  /** Years this adds (+) or takes off (−). All factors add up to `BodyAge.delta`. */
  years: number;
  /** A realistic good target and the years you'd have at it, when it's better than now. */
  lever: { target: number; years: number } | null;
}

export interface BodyAge {
  /** Your age from your birth date, or null when it isn't known. */
  age: number | null;
  /** age + delta, or null without an age. */
  bodyAge: number | null;
  /** Years older (+) or younger (−) than your age. */
  delta: number;
  factors: BodyAgeFactor[];
  /** Factors left out for lack of data, with what's needed. */
  missing: { key: BodyAgeFactorKey; need: string }[];
  /** Days with band data in the window. */
  days: number;
}

const WINDOW = 30;
export const BODY_AGE_MIN_DAYS = 14;
/** 8 years per doubling of risk, at half weight for the overlap between factors. */
export const BODY_AGE_OVERLAP = 0.5;
const YEARS_PER_LN = (BODY_AGE_OVERLAP * 8) / Math.LN2;
const FACTOR_CAP = 3;
const TOTAL_CAP = 10;

/** Linear between [x, ln HR] points, flat past the ends. */
type Curve = [number, number][];
function lnHr(curve: Curve, x: number): number {
  if (x <= curve[0]![0]) return curve[0]![1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i]!;
    const [x0, y0] = curve[i - 1]!;
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return curve.at(-1)![1];
}

/**
 * Hazard-ratio curves (ln HR against the factor), rounded from large meta-analyses:
 * - steps: Paluch 2022 (Lancet Public Health), benefit levels off around 8–10k for under-60s;
 * - sleep hours: Cappuccio 2010, U-shaped, lowest at 7–8 h;
 * - sleep regularity: Windred 2024 (bedtime spread);
 * - resting HR: Zhang 2016, HR 1.09 per +10 bpm;
 * - moderate / vigorous minutes: Arem 2015 and Lee 2022 (Circulation);
 * - strength training: Momma 2022, best around 30–60 min a week;
 * - BMI: Global BMI Mortality Collaboration 2016, lowest at 20–25.
 * VO2max is handled separately (Kodama 2009: HR 0.87 per MET), against age-and-sex norms.
 */
const CURVES: Record<Exclude<BodyAgeFactorKey, "vo2max">, { curve: Curve; typical: number; target: number }> = {
  steps: { curve: [[2000, 0.64], [4000, 0.41], [7000, 0], [10000, -0.16], [12000, -0.2]], typical: 5000, target: 9000 },
  sleepHours: { curve: [[4.5, 0.35], [5, 0.26], [6, 0.12], [7, 0], [8, 0], [9, 0.1], [10, 0.26]], typical: 7, target: 7.5 },
  sleepConsistency: { curve: [[15, -0.05], [30, 0], [60, 0.12], [90, 0.26]], typical: 45, target: 25 },
  restingHr: { curve: [[40, -0.22], [100, 0.3]], typical: 70, target: 0 },
  moderate: { curve: [[0, 0.37], [75, 0.15], [150, 0], [300, -0.09], [450, -0.11]], typical: 75, target: 150 },
  vigorous: { curve: [[0, 0.05], [30, 0], [75, -0.1], [150, -0.18], [300, -0.22]], typical: 15, target: 75 },
  strength: { curve: [[0, 0], [30, -0.12], [60, -0.17], [120, -0.12], [180, -0.05]], typical: 0, target: 60 },
  bmi: { curve: [[16, 0.6], [18.5, 0.4], [20, 0.12], [22.5, 0], [25, 0], [27.5, 0.1], [30, 0.2], [35, 0.42], [40, 0.7]], typical: 24, target: 23 },
};

/** Average VO2max (ml/kg/min) for an age and sex: the middle of the FRIEND registry's treadmill norms. */
export function typicalVo2max(age: number, sex?: Sex): number {
  const male = 48 - 0.43 * (age - 25);
  const female = 38 - 0.37 * (age - 25);
  return round(sex === "male" ? male : sex === "female" ? female : (male + female) / 2, 1);
}

/** Estimated VO2max from max and resting heart rate (Uth et al. 2004). Rough, ±10–15%. */
export function estimateVo2max(maxHr: number, restingHr: number): number {
  return round((15.3 * maxHr) / restingHr, 1);
}

/** ln HR per ml/kg/min of VO2max above the norm (HR 0.87 per MET of 3.5 ml/kg/min). */
const VO2_LN_PER_ML = Math.log(0.87) / 3.5;

/** Minutes of day for a bedtime, shifted by 12 h so evenings and after-midnight bedtimes sort together. */
const bedMinute = (t: number) => {
  const d = new Date(t);
  return (d.getHours() * 60 + d.getMinutes() + 720) % 1440;
};

function stdev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

export interface BodyAgeInput {
  days: DayData[];
  scores: DailyScores[];
  /** Logged workouts in the window (strength ones count as strength training). */
  workouts: LoggedWorkout[];
  /** Age known from a birth date (`ageKnown`), sex, height and latest weight. */
  profile: UserProfile;
  /** Index of the last day to include. Defaults to the latest. */
  endIndex?: number;
}

export function computeBodyAge({ days, scores, workouts, profile, endIndex = days.length - 1 }: BodyAgeInput): BodyAge | null {
  const from = Math.max(0, endIndex - WINDOW + 1);
  const window = days.slice(from, endIndex + 1);
  const windowScores = scores.slice(from, endIndex + 1);
  const worn = window.filter((d) => d.heartRate.length > 0 || d.sleep);
  if (worn.length < BODY_AGE_MIN_DAYS) return null;

  const age = profile.ageKnown ? profile.age : null;
  const values: Partial<Record<BodyAgeFactorKey, { value: number; typical: number; ln: (x: number) => number; target: number }>> = {};
  const missing: BodyAge["missing"] = [];
  const fromCurve = (key: Exclude<BodyAgeFactorKey, "vo2max">, value: number, target?: number) => {
    const c = CURVES[key];
    values[key] = { value, typical: c.typical, ln: (x) => lnHr(c.curve, x), target: target ?? c.target };
  };

  // Resting heart rate and, from it, VO2max.
  const rested = window.flatMap((d) => (d.restingHr ? [d.restingHr] : []));
  if (rested.length >= 7) {
    const rhr = median(rested);
    fromCurve("restingHr", rhr, Math.max(rhr - 5, 45));
    const vo2 = estimateVo2max(estimateMaxHr(profile), rhr);
    const norm = typicalVo2max(profile.age, profile.sex);
    values.vo2max = {
      value: vo2,
      typical: norm,
      ln: (x) => VO2_LN_PER_ML * clamp(x - norm, -15, 15),
      target: round(vo2 + 3, 1),
    };
  } else {
    missing.push({ key: "restingHr", need: "7 nights of resting heart rate" }, { key: "vo2max", need: "7 nights of resting heart rate" });
  }

  // Steps a day, band and phone combined.
  const stepDays = window.flatMap((d) => {
    if (!d.steps?.length) return [];
    return [combineSteps(d.steps, daySamples(d), d.restingHr ?? (rested.length ? median(rested) : 60)).total];
  });
  if (stepDays.length >= 7) fromCurve("steps", Math.round(median(stepDays)));
  else missing.push({ key: "steps", need: "7 days of steps" });

  // Minutes a week at moderate (40–60% of heart-rate reserve) and vigorous (60%+) effort, from
  // days the band was worn most of the waking day.
  const maxHr = estimateMaxHr(profile);
  const covered = window.filter((d) => d.heartRate.length > 0 && d.heartRate.at(-1)!.time - d.heartRate[0]!.time >= 10 * 3_600_000);
  if (covered.length >= 7) {
    let moderate = 0;
    let vigorous = 0;
    for (const d of covered) {
      const rest = d.restingHr ?? (rested.length ? median(rested) : 60);
      const reserve = Math.max(maxHr - rest, 1);
      const hr = d.heartRate;
      for (let i = 1; i < hr.length; i++) {
        const minutes = Math.min((hr[i]!.time - hr[i - 1]!.time) / 60_000, 5);
        const f = (hr[i - 1]!.bpm - rest) / reserve;
        if (f >= 0.6) vigorous += minutes;
        else if (f >= 0.4) moderate += minutes;
      }
    }
    fromCurve("moderate", Math.round((moderate / covered.length) * 7));
    fromCurve("vigorous", Math.round((vigorous / covered.length) * 7));
  } else {
    missing.push({ key: "moderate", need: "7 days wearing the band most of the day" }, { key: "vigorous", need: "7 days wearing the band most of the day" });
  }

  // Strength training a week, from logged gym workouts in the window.
  // From the first day the band was worn, so days before it don't water the weekly figure down.
  const firstWorn = window.indexOf(worn[0]!);
  const start = new Date(`${window[firstWorn]!.date}T00:00:00`).getTime();
  const end = window.at(-1) ? new Date(`${window.at(-1)!.date}T23:59:59`).getTime() : 0;
  const strengthMinutes = workouts
    .filter((w) => w.kind === "strength" && w.start >= start && w.start <= end)
    .reduce((sum, w) => sum + (w.end - w.start) / 60_000, 0);
  fromCurve("strength", Math.round((strengthMinutes / (window.length - firstWorn)) * 7));

  // Sleep: hours and how regular bedtime is.
  const nights = windowScores.flatMap((s) => (s.sleep ? [s.sleep.asleepMinutes / 60] : []));
  if (nights.length >= 7) fromCurve("sleepHours", round(median(nights), 1));
  else missing.push({ key: "sleepHours", need: "7 nights of sleep" });
  const bedtimes = window.flatMap((d) => (d.sleep ? [bedMinute(d.sleep.start)] : []));
  if (bedtimes.length >= 7) fromCurve("sleepConsistency", Math.round(stdev(bedtimes)));
  else missing.push({ key: "sleepConsistency", need: "7 nights of sleep" });

  // Body mass index.
  if (profile.heightCm && profile.weightKg) fromCurve("bmi", round(profile.weightKg / (profile.heightCm / 100) ** 2, 1));
  else missing.push({ key: "bmi", need: profile.heightCm ? "a weigh-in" : "your height" });

  // Years per factor, against a typical adult, capped; then the total, capped, shared out exactly.
  const order: BodyAgeFactorKey[] = ["vo2max", "restingHr", "steps", "moderate", "vigorous", "strength", "sleepHours", "sleepConsistency", "bmi"];
  const yearsAt = (v: NonNullable<(typeof values)[BodyAgeFactorKey]>, x: number) =>
    clamp(YEARS_PER_LN * (v.ln(x) - v.ln(v.typical)), -FACTOR_CAP, FACTOR_CAP);
  const present = order.filter((k) => values[k]);
  const raw = present.map((k) => yearsAt(values[k]!, values[k]!.value));
  const sum = raw.reduce((a, b) => a + b, 0);
  const delta = round(clamp(sum, -TOTAL_CAP, TOTAL_CAP), 1);
  const scaled = sum !== 0 ? raw.map((y) => (y * delta) / sum) : raw;
  const years = roundToTotal(scaled, delta, 1);

  const factors = present.map((key, i): BodyAgeFactor => {
    const v = values[key]!;
    const now = yearsAt(v, v.value);
    const atTarget = yearsAt(v, v.target);
    return {
      key,
      value: v.value,
      typical: v.typical,
      years: years[i]!,
      // Strength past its sweet spot isn't a lever: doing less would only "win" on the curve.
      lever: atTarget < now - 0.1 && !(key === "strength" && v.value > v.target) ? { target: v.target, years: round(atTarget - now, 1) } : null,
    };
  });

  return { age, bodyAge: age != null ? round(age + delta, 1) : null, delta, factors, missing, days: worn.length };
}
