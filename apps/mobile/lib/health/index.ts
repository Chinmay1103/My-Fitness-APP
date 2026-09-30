import { healthConnectSource } from './healthConnectSource';
import { mockSource } from './mockSource';
import type { HealthSource } from './types';

export type { HealthSource } from './types';
export { checkDataTypes, CORE_TYPES, healthConnectSource, openHealthConnectSettings, type DataTypeCheck } from './healthConnectSource';

/**
 * Real data when we can read it, demo data otherwise. Health Connect is used once it's available
 * (our own Android build, not Expo Go) and the user has allowed the reads the scores need, which
 * they do from the Health data screen. HealthKit (iOS) gets added here later.
 */
export async function pickHealthSource(): Promise<HealthSource> {
  try {
    if ((await healthConnectSource.isAvailable()) && (await healthConnectSource.hasPermissions())) {
      return healthConnectSource;
    }
  } catch {
    // Fall through to demo data.
  }
  return mockSource;
}
