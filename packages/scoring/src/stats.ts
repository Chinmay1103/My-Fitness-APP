export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of empty array");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export interface Baseline {
  center: number;
  spread: number;
  n: number;
}

/**
 * Robust personal baseline: median and scaled median absolute deviation.
 * Using median/MAD instead of mean/SD means one bad night doesn't drag the baseline,
 * which keeps scores from swinging to extremes.
 */
export function robustBaseline(values: number[], minSpread: number): Baseline | null {
  if (values.length === 0) return null;
  const center = median(values);
  const mad = median(values.map((v) => Math.abs(v - center)));
  return { center, spread: Math.max(mad * 1.4826, minSpread), n: values.length };
}

export function zScore(value: number, baseline: Baseline, limit = 2.5): number {
  return clamp((value - baseline.center) / baseline.spread, -limit, limit);
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
