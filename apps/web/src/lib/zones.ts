import type { RecoveryZone } from '@fitness/scoring';

export const ZONE_COLOR: Record<RecoveryZone, string> = {
  green: 'var(--green)',
  yellow: 'var(--yellow)',
  red: 'var(--red)',
};

export const ZONE_LABEL: Record<RecoveryZone, string> = {
  green: 'Green (67–100%)',
  yellow: 'Yellow (34–66%)',
  red: 'Red (0–33%)',
};

export const zoneName = (z: RecoveryZone) => z[0]!.toUpperCase() + z.slice(1);
