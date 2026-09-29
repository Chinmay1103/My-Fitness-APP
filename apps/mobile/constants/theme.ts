import type { RecoveryZone } from '@fitness/scoring';

export const colors = {
  background: '#0B0D10',
  card: '#15181D',
  border: '#23272E',
  text: '#F2F4F7',
  muted: '#8A93A0',
  track: '#262B33',
  strain: '#1E9BF0',
  sleep: '#8E9CF5',
  recovery: {
    green: '#2ED573',
    yellow: '#F5C518',
    red: '#FF4757',
  } satisfies Record<RecoveryZone, string>,
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24 };
