import { nightShortfall } from '@fitness/scoring';
import { Legend, TimeChart } from '../components/charts/TimeChart';
import { Card, Empty, StatTile } from '../components/ui';
import { addDays, weekStart } from '../lib/dates';
import { formatClock, formatMinutes, formatNumber } from '../lib/format';
import { METRICS } from '../lib/metrics';
import { mean, stdDev, summarize } from '../lib/stats';
import type { PageProps } from './types';

const STAGES = [
  { key: 'deep', label: 'Deep', color: 'var(--stage-deep)' },
  { key: 'light', label: 'Light', color: 'var(--stage-light)' },
  { key: 'rem', label: 'REM', color: 'var(--stage-rem)' },
  { key: 'awake', label: 'Awake', color: 'var(--stage-awake)' },
] as const;

export function Sleep({ rows, prevRows, openDay, openTrend }: PageProps) {
  const dates = rows.map((r) => r.date);
  const nights = rows.filter((r) => r.day?.asleep != null);
  const bedtimes = nights.flatMap((r) => (r.day!.bedtime != null ? [r.day!.bedtime] : []));
  const wakes = nights.flatMap((r) => (r.day!.wake != null ? [r.day!.wake] : []));
  const prevBed = prevRows.flatMap((r) => (r.day?.bedtime != null ? [r.day.bedtime] : []));
  const debt = nights.reduce((sum, r) => sum + nightShortfall(r.day!.scores), 0);
  const spread = stdDev(bedtimes);
  const fmtH = (h: number) => formatMinutes(h * 60);

  // Stages: one bar a night up to ~4 months; past that, a weekly average so the bars stay readable.
  const weekly = rows.length > 120;
  const stageDates = weekly ? [...new Set(dates.map(weekStart))].filter((d) => d <= dates.at(-1)!) : dates;
  const stageValue = (key: (typeof STAGES)[number]['key']) =>
    stageDates.map((d) => {
      const inBucket = weekly ? rows.filter((r) => r.date >= d && r.date <= addDays(d, 6)) : rows.filter((r) => r.date === d);
      const v = mean(inBucket.map((r) => (r.day?.stages ? r.day.stages[key] / 60 : null)));
      return v;
    });
  const hasStages = rows.some((r) => r.day?.stages);

  return (
    <>
      <div className="tiles">
        <StatTile def={METRICS.asleep} value={summarize(rows, 'asleep').avg} previous={summarize(prevRows, 'asleep').avg} onClick={() => openTrend('asleep')} />
        <StatTile def={METRICS.sleepScore} value={summarize(rows, 'sleepScore').avg} previous={summarize(prevRows, 'sleepScore').avg} onClick={() => openTrend('sleepScore')} />
        <StatTile def={METRICS.bedtime} value={mean(bedtimes)} previous={mean(prevBed)} onClick={() => openTrend('bedtime')} />
        <div className="stat">
          <span className="stat-label">Wake time</span>
          <span className="stat-value num">{wakes.length ? formatClock(mean(wakes)!) : '—'}</span>
          <span className="stat-delta neutral">average</span>
        </div>
        <div className="stat">
          <span className="stat-label">Bedtime consistency</span>
          <span className="stat-value num">{spread == null ? '—' : `±${Math.round(spread)} min`}</span>
          <span className="stat-delta neutral">typical spread; under ±30 min is steady</span>
        </div>
        <div className="stat">
          <span className="stat-label">Sleep debt</span>
          <span className="stat-value num">{formatMinutes(debt)}</span>
          <span className="stat-delta neutral">short of need, added up over {formatNumber(nights.length)} nights</span>
        </div>
      </div>

      <Card title="Hours slept against need" subtitle="Bars are time asleep; the tick is what that night needed (base need + extra after hard days + paying back debt).">
        {nights.length ? (
          <>
            <TimeChart
              dates={dates}
              height={260}
              yFormat={(v) => `${v}h`}
              onPick={openDay}
              summary={`Hours slept each night, averaging ${fmtH(summarize(rows, 'asleep').avg ?? 0)}.`}
              series={[
                { kind: 'bars', label: 'Asleep', color: 'var(--sleep)', values: rows.map((r) => r.values.asleep), format: fmtH },
                { kind: 'ticks', label: 'Needed', color: 'var(--text)', values: rows.map((r) => (r.day?.need != null ? r.day.need / 60 : null)), format: fmtH },
              ]}
            />
            <Legend items={[{ label: 'Asleep', color: 'var(--sleep)' }, { label: 'Needed', color: 'var(--text)', shape: 'line' }]} />
          </>
        ) : (
          <Empty>No nights in this range yet.</Empty>
        )}
      </Card>

      <Card title="When you slept" subtitle="Each bar runs from falling asleep to waking up. Steady bars mean a steady body clock.">
        {bedtimes.length ? (
          <TimeChart
            dates={dates}
            height={260}
            invert
            clock
            zeroBased={false}
            yFormat={formatClock}
            onPick={openDay}
            summary={`Sleep times: average bedtime ${formatClock(mean(bedtimes)!)}, average wake time ${wakes.length ? formatClock(mean(wakes)!) : 'unknown'}.`}
            series={[
              {
                kind: 'range',
                label: 'Asleep',
                color: 'var(--sleep)',
                values: rows.map((r) => (r.day?.bedtime != null && r.day.wake != null ? [r.day.bedtime, r.day.wake] : null)),
                format: ([a, b]) => `${formatClock(a)} – ${formatClock(b)}`,
              },
            ]}
          />
        ) : (
          <Empty>No sleep times in this range yet.</Empty>
        )}
      </Card>

      <Card title="Sleep stages" subtitle={weekly ? 'Average hours per night, one bar per week (starting Monday).' : 'Hours in each stage, per night.'}>
        {hasStages ? (
          <>
            <TimeChart
              dates={stageDates}
              height={260}
              yFormat={(v) => `${v}h`}
              onPick={weekly ? undefined : openDay}
              summary="Hours of deep, light, REM sleep and awake time per night."
              series={[{ kind: 'stack', parts: STAGES.map((s) => ({ label: s.label, color: s.color, values: stageValue(s.key) })), format: fmtH }]}
            />
            <Legend items={STAGES.map((s) => ({ label: s.label, color: s.color }))} />
          </>
        ) : (
          <Empty>Sleep stages reach the website once the phone app with the website update has synced.</Empty>
        )}
      </Card>
    </>
  );
}
