import { useState } from 'react';

import { Card, DayLink, Empty, Segmented } from '../components/ui';
import { download, toCsv } from '../lib/csv';
import { formatClock, formatDate, formatMinutes, formatMonth, formatNumber, formatShort } from '../lib/format';
import { METRIC_ORDER, METRICS } from '../lib/metrics';
import { periods, type PeriodRow, type PeriodUnit } from '../lib/stats';
import { ZONE_COLOR } from '../lib/zones';
import type { PageProps } from './types';

const fmt = (v: number | null | undefined, f: (n: number) => string) => (v == null ? '—' : f(v));

function periodLabel(p: PeriodRow, unit: PeriodUnit): string {
  return unit === 'month' ? formatMonth(p.start) : `${formatShort(p.start)} – ${formatShort(p.end)}`;
}

export function Reports({ data, rows, openDay }: PageProps) {
  const [unit, setUnit] = useState<PeriodUnit>(rows.length > 120 ? 'month' : 'week');
  const list = periods(rows, unit).reverse();
  const from = rows[0]!.date;
  const to = rows.at(-1)!.date;
  const coachReports = data.reports.filter((r) => r.weekEnd >= from && r.weekEnd <= to).reverse();

  const exportDays = () => {
    const keys = METRIC_ORDER;
    download(
      `my-fitness-days-${from}-to-${to}.csv`,
      toCsv(
        ['date', 'recovery_zone', ...keys.map((k) => `${k}${METRICS[k].unit ? `_${METRICS[k].unit.replace(/[^a-z%]/gi, '')}` : ''}`), 'sleep_needed_h', 'workouts', 'coach_note'],
        rows.map((r) => [
          r.date,
          r.day?.zone ?? '',
          ...keys.map((k) => {
            const v = r.values[k];
            if (v == null) return '';
            if (k === 'bedtime') return formatClock(v);
            return Math.round(v * 100) / 100;
          }),
          r.day?.need != null ? Math.round((r.day.need / 60) * 100) / 100 : '',
          r.workouts,
          data.notes.find((n) => n.date === r.date)?.headline ?? '',
        ]),
      ),
    );
  };

  const exportPeriods = () => {
    download(
      `my-fitness-${unit}s-${from}-to-${to}.csv`,
      toCsv(
        [unit, 'days_with_data', 'recovery_%', 'green', 'yellow', 'red', 'strain', 'sleep_score_%', 'asleep_h', 'sleep_debt_min', 'hrv_ms', 'resting_hr_bpm', 'workouts', 'zone_minutes', 'steps', 'calories_in', 'protein_g', 'weight_kg'],
        [...list].reverse().map((p) => {
          const a = p.averages;
          const r = (v: number | null | undefined, d = 0) => (v == null ? '' : Math.round(v * 10 ** d) / 10 ** d);
          return [periodLabel(p, unit), p.days, r(a.recovery), p.green, p.yellow, p.red, r(a.strain, 1), r(a.sleepScore), r(a.asleep, 2), p.sleepDebt, r(a.hrv), r(a.restingHr), p.workouts, p.zoneMinutes, r(a.steps), r(a.caloriesIn), r(a.protein), r(a.weight, 1)];
        }),
      ),
    );
  };

  return (
    <>
      <div className="controls no-print">
        <Segmented
          label="Group by"
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'week', label: 'Weekly' },
            { value: 'month', label: 'Monthly' },
          ]}
        />
        <button type="button" className="button" onClick={exportPeriods}>
          Download {unit === 'week' ? 'weeks' : 'months'} (CSV)
        </button>
        <button type="button" className="button" onClick={exportDays}>
          Download every day (CSV)
        </button>
        <button type="button" className="button" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>

      <Card title={unit === 'week' ? 'Week by week' : 'Month by month'} subtitle={`${formatDate(from)} to ${formatDate(to)}. Averages over the days with data; newest first.`}>
        {list.some((p) => p.days) ? (
          <div className="table-scroll">
            <table className="table report">
              <thead>
                <tr>
                  <th>{unit === 'week' ? 'Week' : 'Month'}</th>
                  <th className="r">Days</th>
                  <th className="r">Recovery</th>
                  <th>Zones</th>
                  <th className="r">Strain</th>
                  <th className="r">Sleep</th>
                  <th className="r">Asleep</th>
                  <th className="r">Debt</th>
                  <th className="r">HRV</th>
                  <th className="r">Resting HR</th>
                  <th className="r">Workouts</th>
                  <th className="r">Steps</th>
                  <th className="r">Weight</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const a = p.averages;
                  const scored = p.green + p.yellow + p.red;
                  return (
                    <tr key={p.start}>
                      <td>
                        <DayLink date={p.end} onPick={openDay}>
                          {periodLabel(p, unit)}
                        </DayLink>
                      </td>
                      <td className="r num muted">{p.days}</td>
                      <td className="r num">{fmt(a.recovery, (v) => `${Math.round(v)}%`)}</td>
                      <td>
                        {scored ? (
                          <span className="zone-bar" title={`${p.green} green, ${p.yellow} yellow, ${p.red} red`} aria-label={`${p.green} green, ${p.yellow} yellow, ${p.red} red`}>
                            {(['green', 'yellow', 'red'] as const).map((z) => (p[z] ? <span key={z} style={{ flexGrow: p[z], background: ZONE_COLOR[z] }} /> : null))}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="r num">{fmt(a.strain, (v) => v.toFixed(1))}</td>
                      <td className="r num">{fmt(a.sleepScore, (v) => `${Math.round(v)}%`)}</td>
                      <td className="r num">{fmt(a.asleep, (v) => formatMinutes(v * 60))}</td>
                      <td className="r num">{p.sleepDebt ? formatMinutes(p.sleepDebt) : '—'}</td>
                      <td className="r num">{fmt(a.hrv, (v) => `${Math.round(v)}`)}</td>
                      <td className="r num">{fmt(a.restingHr, (v) => `${Math.round(v)}`)}</td>
                      <td className="r num">{p.workouts || '—'}</td>
                      <td className="r num">{fmt(a.steps, (v) => formatNumber(Math.round(v)))}</td>
                      <td className="r num">{fmt(a.weight, (v) => v.toFixed(1))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No data in this range yet.</Empty>
        )}
        <p className="muted small">Debt is the time slept short of need, added up. HRV in ms, resting HR in bpm, weight in kg.</p>
      </Card>

      <Card title="Weekly reports from the coach" subtitle="Saved by Claude when you ask how the week went.">
        {coachReports.length ? (
          <div className="reports">
            {coachReports.map((r) => (
              <article key={r.weekEnd} className="note">
                <p className="muted small">Week ending {formatDate(r.weekEnd)}</p>
                <p className="note-headline">{r.headline}</p>
                <p>{r.summary}</p>
                <p>
                  <strong>Focus next week:</strong> {r.focus}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <Empty>No weekly reports in this range. On a Sunday or Monday, ask the coach how your week went.</Empty>
        )}
      </Card>
    </>
  );
}
