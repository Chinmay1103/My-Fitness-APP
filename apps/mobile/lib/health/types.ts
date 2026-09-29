import type { DayData } from '@fitness/scoring';

/**
 * Where health data comes from. The rest of the app only talks to this interface,
 * so adding Health Connect (Android) and HealthKit (iOS) means adding one source each.
 */
export interface HealthSource {
  id: 'mock' | 'health-connect' | 'healthkit';
  label: string;
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  /** The last `days` days, oldest first. */
  getDays(days: number): Promise<DayData[]>;
}
