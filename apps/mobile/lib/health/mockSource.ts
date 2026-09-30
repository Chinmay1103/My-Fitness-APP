import { generateMockDays } from '@fitness/scoring';

import type { HealthSource } from './types';

export const mockSource: HealthSource = {
  id: 'mock',
  label: 'Demo data',
  isAvailable: async () => true,
  hasPermissions: async () => true,
  requestPermissions: async () => true,
  getDays: async (days) => generateMockDays({ days }),
};
