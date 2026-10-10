import { Calendar } from '../components/charts/Calendar';
import { Legend, TimeChart } from '../components/charts/TimeChart';
import { Card, Empty, StatTile } from '../components/ui';
import { formatDate, formatNumber } from '../lib/format';
import { METRICS, type MetricKey } from '../lib/metrics';
import { periods, summarize, zoneMix } from '../lib/stats';
import { recoveryZone } from '@fitness/scoring';
import { ZONE_COLOR, ZONE_LABEL, zoneName } from '../lib/zones';
import type { PageProps } from './types';

const TILES: MetricKey[] = ['recovery', 'strain', 'sleepScore', 'asleep', 'hrv', 'restingHr'];

export function Overview({ data, rows, prevRows, openDay, openTrend }: PageProps) {
  const dates = rows.map((r) => r.date);
  const mix = zoneMix(rows);
  const scored = mix.green + mix.yellow + mix.red;
  const synced = rows.filter((r) => r.day).length;
  const from = rows[0]!.date;
  const to = rows.at(-1)!.date;
  const latestNote = [...data.notes].reverse().find((n) => n.date >= from && n.date <= to);
  // Past ~4 months a bar a day is too thin to read: one bar a week (its average) instead.
  const weekly = rows.length > 120;
  const weeks = weekly ? periods(rows, 'week') : [];
  const barDates = weekly ? weeks.map((w) => w.start) : dates;
  const recoveryBars = weekly ? weeks.map((w) => w.averages.recovery ?? null) : rows.map((r) => r.values.recovery);
  const recoveryZones = weekly
    ? recoveryBars.map((v) => (v == null ? null : recoveryZone(Math.round(v))))
    : rows.map((r) => r.day?.zone ?? null);
  const strainBars = weekly ? weeks.map((w) => w.averages.strain ?? null) : rows.map((r) => (r.day ? r.values.strain : null));

  return (
    <>
      <div className="tiles">
        {TILES.map((k) => (
          <StatTile key={k} def={METRICS[k]} value={summarize(rows, k).avg} previous={summarize(prevRows, k).avg} onClick={() => openTrend(k)} />
        ))}
      </div>
      <p className="muted small">
        Averages over {formatNumber(synced)} of {formatNumber(rows.length)} days with data. Click a number for its full trend.
      </p>

      <div className="grid-2">
        <Card title="Recovery mix" subtitle={`${formatNumber(scored)} scored mornings`}>
          {scored ? (
            <>
              <div className="mix" role="img" aria-label={`Green ${mix.green}, yellow ${mix.yellow}, red ${mix.red} days`}>
                {(['green', 'yellow', 'red'] as const).map((z) =>
                  mix[z] ? <span key={z} style={{ flexGrow: mix[z], background: ZONE_COLOR[z] }} /> : null,
                )}
              </div>
              <ul className="mix-list">
                {(['green', 'yellow', 'red'] as const).map((z) => (
                  <li key={z}>
                    <span className="key-square" style={{ background: ZONE_COLOR[z] }} />
                    <span>{ZONE_LABEL[z]}</span>
                    <strong className="num">{mix[z]}</strong>
                    <span className="muted">{Math.round((mix[z] / scored) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty>No recovery scores in this range yet. Recovery needs 4 nights of HRV and resting heart rate.</Empty>
          )}
        </Card>
        <Card title="Latest coach note" subtitle={latestNote ? formatDate(latestNote.date) : undefined}>
          {latestNote ? (
            <div className="note">
              <p className="note-headline">{latestNote.headline}</p>
              <p>{latestNote.why}</p>
              {latestNote.tips.length ? (
                <ul>
                  {latestNote.tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              ) : null}
              <button type="button" className="link" onClick={() => openDay(latestNote.date)}>
                Open that day ›
              </button>
            </div>
          ) : (
            <Empty>No coach note in this range. Ask the coach how your day is going and it saves one.</Empty>
          )}
        </Card>
      </div>

      <Card title="Recovery calendar" subtitle="Every morning in the range, by recovery zone. Click a day to open it.">
        <Calendar
          from={from}
          to={to}
          color={(d) => {
            const z = rows.find((r) => r.date === d)?.day?.zone;
            return z ? ZONE_COLOR[z] : null;
          }}
          describe={(d) => {
            const day = rows.find((r) => r.date === d)?.day;
            if (!day) return null;
            if (day.recovery == null || !day.zone) return { color: 'var(--track)', label: 'Recovery not scored', value: '—' };
            return { color: ZONE_COLOR[day.zone], label: `Recovery · ${zoneName(day.zone)}`, value: `${day.recovery}%` };
          }}
          onPick={openDay}
          summary={`Recovery calendar from ${formatDate(from)} to ${formatDate(to)}: ${mix.green} green, ${mix.yellow} yellow, ${mix.red} red mornings.`}
        />
        <Legend
          items={[
            ...(['green', 'yellow', 'red'] as const).map((z) => ({ label: ZONE_LABEL[z], color: ZONE_COLOR[z] })),
            { label: 'No score', color: 'var(--track)' },
          ]}
        />
      </Card>

      <Card title={weekly ? 'Recovery, week by week' : 'Recovery, day by day'} subtitle={weekly ? 'Weekly averages (bars start on Monday), colored by zone.' : 'Colored by zone.'}>
        <TimeChart
          dates={barDates}
          domain={[0, 100]}
          yFormat={(v) => `${v}%`}
          onPick={weekly ? undefined : openDay}
          summary={`Recovery each ${weekly ? 'week' : 'day'}, averaging ${Math.round(summarize(rows, 'recovery').avg ?? 0)}%.`}
          series={[
            {
              kind: 'bars',
              label: 'Recovery',
              color: 'var(--recovery)',
              values: recoveryBars,
              colors: recoveryZones.map((z) => (z ? ZONE_COLOR[z] : null)),
              colorLabels: recoveryZones.map((z) => (z ? zoneName(z) : null)),
              format: (v) => METRICS.recovery.format(Math.round(v)),
            },
          ]}
        />
      </Card>
      <Card title={weekly ? 'Strain, week by week' : 'Strain, day by day'} subtitle={`0–21. Above 14 is a hard day; above 18 is all out.${weekly ? ' Weekly averages.' : ''}`}>
        <TimeChart
          dates={barDates}
          domain={[0, 21]}
          onPick={weekly ? undefined : openDay}
          summary={`Strain each ${weekly ? 'week' : 'day'}, averaging ${(summarize(rows, 'strain').avg ?? 0).toFixed(1)}.`}
          series={[{ kind: 'bars', label: 'Strain', color: 'var(--strain)', values: strainBars, format: METRICS.strain.format }]}
        />
      </Card>
    </>
  );
}
