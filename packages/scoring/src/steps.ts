import type { HeartRateSample, Timestamp } from "./types";

const MINUTE = 60_000;
/** Steps are compared phone vs band in windows this long. */
export const STEP_WINDOW_MINUTES = 5;
const WINDOW = STEP_WINDOW_MINUTES * MINUTE;
/** Band-only steps count when heart rate in that window is at least this far above resting... */
const WALKING_HR_LIFT = 8;
/** ...or when there are this many of them: a sustained walking cadence (80 a minute), not arm movement. */
const SUSTAINED_WINDOW_STEPS = 80 * STEP_WINDOW_MINUTES;
/** When both counted, the band may be at most this much above the phone (wrist vs pocket differ a little). */
const BAND_OVER_PHONE_RATIO = 1.3;
const BAND_OVER_PHONE_EXTRA = 30;

/** Which device counted a stretch of steps. Unknown devices are treated as the band. */
export type StepDevice = "band" | "phone";

export interface StepRecord {
  start: Timestamp;
  end: Timestamp;
  count: number;
  device: StepDevice;
}

export interface StepTotals {
  /** Steps we believe: the band's, checked against the phone and heart rate. */
  total: number;
  /** What each device counted on its own. */
  band: number;
  phone: number;
  /** Band steps dropped: the phone saw no walking and heart rate stayed flat, or the band ran far ahead of the phone. */
  ghost: number;
  /** Steps only the phone counted (band off the wrist or charging). Included in `total`. */
  phoneOnly: number;
  /** Believed steps per local hour, 0 = midnight to 1 AM. */
  hourly: number[];
}

/** Spreads each record's steps evenly over the windows it covers. */
function bucket(records: StepRecord[], device: StepDevice): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of records) {
    if (r.device !== device || r.count <= 0) continue;
    const span = Math.max(r.end - r.start, 1);
    for (let w = Math.floor(r.start / WINDOW) * WINDOW; w < Math.max(r.end, r.start + 1); w += WINDOW) {
      const overlap = Math.min(r.end, w + WINDOW) - Math.max(r.start, w);
      const share = r.end > r.start ? (r.count * Math.max(overlap, 0)) / span : r.count;
      if (share > 0) out.set(w, (out.get(w) ?? 0) + share);
    }
  }
  return out;
}

/**
 * One day's steps from the band and the phone together. The band sees every step but also counts
 * arm movement ("ghost steps", e.g. on a scooter); the phone only counts while carried. So for each
 * 5-minute window:
 * - both counted: the phone confirms walking; keep the band's count, but not far above the phone's
 *   (and never the phone's when it's higher: a phone bouncing in a vehicle counts steps too);
 * - only the band: keep it if heart rate rose or the cadence was a real walk, else it's ghost steps;
 *   with no heart rate to check against, keep it;
 * - only the phone: keep it (the band was off).
 */
export function combineSteps(records: StepRecord[], heartRate: HeartRateSample[], restingHr: number): StepTotals {
  const band = bucket(records, "band");
  const phone = bucket(records, "phone");
  const hr = new Map<number, { sum: number; n: number }>();
  for (const s of heartRate) {
    const w = Math.floor(s.time / WINDOW) * WINDOW;
    const m = hr.get(w) ?? { sum: 0, n: 0 };
    m.sum += s.bpm;
    m.n += 1;
    hr.set(w, m);
  }

  const hourly = Array.from({ length: 24 }, () => 0);
  let total = 0;
  let ghost = 0;
  let phoneOnly = 0;
  for (const w of new Set([...band.keys(), ...phone.keys()])) {
    const b = band.get(w) ?? 0;
    const p = phone.get(w) ?? 0;
    let kept: number;
    if (b > 0 && p > 0) {
      kept = Math.min(b, p * BAND_OVER_PHONE_RATIO + BAND_OVER_PHONE_EXTRA);
    } else if (b > 0) {
      const h = hr.get(w);
      const walking = !h || h.sum / h.n >= restingHr + WALKING_HR_LIFT || b >= SUSTAINED_WINDOW_STEPS;
      kept = walking ? b : 0;
    } else {
      kept = p;
      phoneOnly += p;
    }
    ghost += Math.max(b - kept, 0);
    total += kept;
    const hour = new Date(w).getHours();
    hourly[hour] = hourly[hour]! + kept;
  }

  const sum = (m: Map<number, number>) => [...m.values()].reduce((a, v) => a + v, 0);
  return {
    total: Math.round(total),
    band: Math.round(sum(band)),
    phone: Math.round(sum(phone)),
    ghost: Math.round(ghost),
    phoneOnly: Math.round(phoneOnly),
    hourly: hourly.map(Math.round),
  };
}
