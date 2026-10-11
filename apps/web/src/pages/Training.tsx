import { trainingLoad, WEEKLY_ZONE_MINUTES_GOAL } from '@fitness/scoring';
import { useState } from 'react';

import { Legend, TimeChart } from '../components/charts/TimeChart';
import { Overload } from '../components/Overload';
import { Card, DayLink, Empty, StatTile } from '../components/ui';
import { formatDate, formatMinutes, formatNumber } from '../lib/format';
import { buildRows, METRICS } from '../lib/metrics';
import { addDays } from '../lib/dates';
import { denseScores, summarize } from '../lib/stats';
import type { PageProps } from './types';

const LOAD_WORDS = {
  fresh: 'Fresh: less than you are used to',
  steady: 'Steady: about what you are used to',
  building: 'Building: a step up, fine for a while',
  overreaching: 'Overreaching: well above your usual, ease off',
} as const;

const PAGE = 25;

export function Training({ data, rows, prevRows, openDay, openTrend }: PageProps) {
  const [shown, setShown] = useState(PAGE);
  const from = rows[0]!.date;
  const to = rows.at(-1)!.date;
  const workouts = data.workouts.filter((w) => w.date >= from && w.date <= to);
  // Load needs the weeks before the range too: score from 28 days earlier, then keep the range.
  const loads = trainingLoad(denseScores(buildRows(data, addDays(from, -27), to))).slice(-rows.length);
  const latest = [...loads].reverse().find((l) => l.ratio != null);
  const weeks = rows.length / 7;
  const azm = rows.reduce((a, r) => a + (r.day?.zoneMinutes ?? 0), 0);

  const kinds = new Map<string, { count: number; minutes: number; efforts: number[] }>();
  for (const w of workouts) {
    const k = kinds.get(w.kind) ?? { count: 0, minutes: 0, efforts: [] };
    k.count++;
    k.minutes += (w.end - w.start) / 60_000;
    if (w.effort != null) k.efforts.push(w.effort);
    kinds.set(w.kind, k);
  }
  const byKind = [...kinds.entries()].sort((a, b) => b[1].count - a[1].count);
  const newestFirst = [...workouts].reverse();

  return (
    <>
      <div className="tiles">
        <StatTile def={METRICS.strain} value={summarize(rows, 'strain').avg} previous={summarize(prevRows, 'strain').avg} onClick={() => openTrend('strain')} />
        <div className="stat">
          <span className="stat-label">Workouts logged</span>
          <span className="stat-value num">{formatNumber(workouts.length)}</span>
          <span className="stat-delta neutral">{weeks >= 1 ? `${(workouts.length / weeks).toFixed(1)} a week` : 'in this range'}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Active Zone Minutes</span>
          <span className="stat-value num">{azm ? formatNumber(Math.round(azm / Math.max(1, weeks))) : '—'}</span>
          <span className="stat-delta neutral">a week on average; goal {WEEKLY_ZONE_MINUTES_GOAL}</span>
        </div>
        <StatTile def={METRICS.steps} value={summarize(rows, 'steps').avg} previous={summarize(prevRows, 'steps').avg} onClick={() => openTrend('steps')} />
      </div>

      <Overload workouts={workouts} dates={rows.map((r) => r.date)} openDay={openDay} />

      <Card title="Training load" subtitle="The last 7 days' average load against the last 28 days'. Days without data count as rest.">
        {latest ? <p className="finding">Now: {LOAD_WORDS[latest.zone!]} (ratio {latest.ratio!.toFixed(2)}).</p> : null}
        {rows.length >= 14 ? (
          <>
            <TimeChart
              dates={rows.map((r) => r.date)}
              height={240}
              yFormat={(v) => String(Math.round(v))}
              onPick={openDay}
              summary="Seven-day and twenty-eight-day average training load."
              series={[
                { kind: 'line', label: 'Last 7 days', color: 'var(--strain)', values: loads.map((l) => l.acute), format: (v) => `${Math.round(v)} load` },
                { kind: 'line', label: 'Last 28 days (your usual)', color: 'var(--muted)', values: loads.map((l) => l.chronic), format: (v) => `${Math.round(v)} load` },
              ]}
            />
            <Legend
              items={[
                { label: 'Last 7 days', color: 'var(--strain)', shape: 'line' },
                { label: 'Last 28 days (your usual)', color: 'var(--muted)', shape: 'line' },
              ]}
            />
          </>
        ) : (
          <Empty>Pick a range of at least 14 days to see training load.</Empty>
        )}
      </Card>

      <Card title="Workouts by type" subtitle="From what you told the coach.">
        {byKind.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th className="r">Sessions</th>
                <th className="r">Total time</th>
                <th className="r">Avg effort</th>
              </tr>
            </thead>
            <tbody>
              {byKind.map(([kind, k]) => (
                <tr key={kind}>
                  <td className="cap">{kind}</td>
                  <td className="r num">{k.count}</td>
                  <td className="r num">{formatMinutes(k.minutes)}</td>
                  <td className="r num">{k.efforts.length ? `${(k.efforts.reduce((a, b) => a + b, 0) / k.efforts.length).toFixed(1)}/10` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No workouts logged in this range. Tell the coach what you trained and it shows up here.</Empty>
        )}
      </Card>

      {newestFirst.length ? (
        <Card title="Workout log" subtitle="Newest first. Click a date to see that day.">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Workout</th>
                <th className="r">Time</th>
                <th className="r">Effort</th>
                <th className="r">Day strain</th>
              </tr>
            </thead>
            <tbody>
              {newestFirst.slice(0, shown).map((w) => {
                const day = rows.find((r) => r.date === w.date)?.day;
                return (
                  <tr key={w.id}>
                    <td>
                      <DayLink date={w.date} onPick={openDay}>
                        {formatDate(w.date)}
                      </DayLink>
                    </td>
                    <td className="cap">
                      {w.title ?? w.kind}
                      {w.distanceKm ? <span className="muted"> · {w.distanceKm} km</span> : null}
                    </td>
                    <td className="r num">{formatMinutes((w.end - w.start) / 60_000)}</td>
                    <td className="r num">{w.effort != null ? `${w.effort}/10` : '—'}</td>
                    <td className="r num">{day ? day.strain.toFixed(1) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown < newestFirst.length ? (
            <button type="button" className="button" onClick={() => setShown((s) => s + PAGE * 2)}>
              Show more ({newestFirst.length - shown} left)
            </button>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
