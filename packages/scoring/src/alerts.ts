import type { HeartRateSample } from "./types";

/**
 * Whether heart rate has stayed at or above `thresholdBpm` for at least `sustainMs`, ending at the
 * latest reading. One high reading (a sneeze, a bad contact) isn't enough, and a gap longer than
 * `maxGapMs` between readings breaks the run, so a lost connection never counts as "still high".
 * `samples` oldest first. Returns the latest bpm when it fires, else null.
 */
export function sustainedAbove(
  samples: HeartRateSample[],
  thresholdBpm: number,
  sustainMs: number,
  maxGapMs = 15_000,
): number | null {
  const latest = samples.at(-1);
  if (!latest || latest.bpm < thresholdBpm) return null;
  let earliest = latest.time;
  for (let i = samples.length - 2; i >= 0; i--) {
    const s = samples[i]!;
    if (s.bpm < thresholdBpm || earliest - s.time > maxGapMs) break;
    earliest = s.time;
    if (latest.time - earliest >= sustainMs) return latest.bpm;
  }
  return null;
}
