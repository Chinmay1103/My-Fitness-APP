import type { Dataset } from '../lib/data';
import type { MetricKey, Row } from '../lib/metrics';

export interface PageProps {
  data: Dataset;
  /** One row per date in the picked range, gaps included. */
  rows: Row[];
  /** The same number of days just before it, for "vs previous period". */
  prevRows: Row[];
  openDay: (date: string) => void;
  openTrend: (key: MetricKey) => void;
}
