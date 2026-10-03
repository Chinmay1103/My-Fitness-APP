import { generateMockDays } from '@fitness/scoring';

import type { HealthSource } from './types';

export const mockSource: HealthSource = {
  id: 'mock',
  label: 'Demo data',
  isAvailable: async () => true,
  hasPermissions: async () => true,
  requestPermissions: async () => true,
  getDays: async (days) => generateMockDays({ days }),
  getHeartRate: async (from, to) =>
    generateMockDays({ days: Math.ceil((Date.now() - from.getTime()) / 86_400_000) + 1 })
      .flatMap((d) => [...(d.sleepHeartRate ?? []), ...d.heartRate])
      .filter((s) => s.time >= from.getTime() && s.time <= to.getTime())
      .sort((a, b) => a.time - b.time),
};
