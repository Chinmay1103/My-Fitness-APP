import type { DayData, HeartRateSample } from '@fitness/scoring';

/**
 * Where health data comes from. The rest of the app only talks to this interface,
 * so adding Health Connect (Android) and HealthKit (iOS) means adding one source each.
 */
export interface HealthSource {
  id: 'mock' | 'health-connect' | 'healthkit';
  label: string;
  isAvailable(): Promise<boolean>;
  /** Whether the reads the scores need are already allowed (no dialog). */
  hasPermissions(): Promise<boolean>;
  /** Shows the system permission dialog; resolves to `hasPermissions()` afterwards. */
  requestPermissions(): Promise<boolean>;
  /** The last `days` days, oldest first. */
  getDays(days: number): Promise<DayData[]>;
  /** Every heart-rate sample in a time range, oldest first. Cheap enough to call every minute for today. */
  getHeartRate(from: Date, to: Date): Promise<HeartRateSample[]>;
}
