import { useState } from 'react';

import { Scatter } from '../components/charts/Scatter';
import { Legend, TimeChart } from '../components/charts/TimeChart';
import { Card, DayLink, Empty, Segmented, StatTile } from '../components/ui';
import { formatDate, formatMonth, formatNumber } from '../lib/format';
import { METRIC_ORDER, METRICS, type MetricKey } from '../lib/metrics';
import { describeR, fit, pairs, periods, rollingMean, summarize } from '../lib/stats';
import type { PageProps } from './types';

/** Value at fraction q of the sorted values. */
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export function Trends({ rows, prevRows, openDay, metric }: PageProps & { metric: MetricKey; setMetric: (k: MetricKey) => void }) {
  const def = METRICS[metric];
  const values = rows.map((r) => r.values[metric]);
  const present = values.filter((v): v is number => v != null).sort((a, b) => a - b);
  // Longer ranges get a longer average, or the line is as noisy as the days.
  const window = rows.length > 180 ? 30 : 7;
  const avg = rollingMean(values, window, def.sparse ? 1 : Math.min(3, window));
  const sum = summarize(rows, metric);
  const prev = summarize(prevRows, metric);
  const band = present.length >= 14 ? { low: quantile(present, 0.25), high: quantile(present, 0.75) } : undefined;
  const months = periods(rows, 'month');
  const monthValues = months.map((p) => rowsMean(rows, metric, p.start, p.end));

  return (
    <>
      <div className="tiles tiles-3">
        <StatTile def={def} value={sum.avg} previous={prev.avg} />
        <div className="stat">
          <span className="stat-label">Highest</span>
          <span className="stat-value num">{sum.max ? def.format(sum.max.value) : '—'}</span>
          <span className="stat-delta neutral">{sum.max ? <DayLink date={sum.max.date} onPick={openDay}>{formatDate(sum.max.date)}</DayLink> : 'no data'}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Lowest</span>
          <span className="stat-value num">{sum.min ? def.format(sum.min.value) : '—'}</span>
          <span className="stat-delta neutral">{sum.min ? <DayLink date={sum.min.date} onPick={openDay}>{formatDate(sum.min.date)}</DayLink> : 'no data'}</span>
        </div>
      </div>

      <Card
        title={def.label}
        subtitle={
          <>
            {def.about} {formatNumber(sum.count)} days with data.
            {band ? ` The shaded band is your middle half: ${def.format(band.low)} to ${def.format(band.high)}.` : ''}
          </>
        }
      >
        {sum.count ? (
          <>
            <TimeChart
              dates={rows.map((r) => r.date)}
              height={300}
              zeroBased={def.zeroBased}
              domain={def.domain}
              yFormat={(v) => (def.key === 'asleep' ? `${v}h` : def.format(v).replace(/ (bpm|ms|kcal|kg|min|br\/min|g|°C)$/, ''))}
              invert={metric === 'bedtime'}
              clock={metric === 'bedtime'}
              band={band}
              onPick={openDay}
              summary={`${def.label} from ${formatDate(rows[0]!.date)} to ${formatDate(rows.at(-1)!.date)}, averaging ${sum.avg == null ? 'no value' : def.format(sum.avg)}.`}
              series={[
                { kind: 'line', label: 'Each day', color: def.color, values, format: def.format, faint: true, connectGaps: def.sparse },
                { kind: 'line', label: `${window}-day average`, color: def.color, values: avg, format: def.format },
              ]}
            />
            <Legend
              items={[
                { label: 'Each day', color: def.color, shape: 'line' },
                { label: `${window}-day average`, color: def.color, shape: 'line' },
                ...(band ? [{ label: 'Your middle half', color: 'var(--band)' }] : []),
              ]}
            />
          </>
        ) : (
          <Empty>No {def.label.toLowerCase()} in this range yet.{missingHint(metric)}</Empty>
        )}
      </Card>

      {sum.count && months.length > 1 ? (
        <Card title={`${def.label} by month`} subtitle="Monthly averages.">
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="r">Average</th>
                <th className="r">Change</th>
                <th>Days</th>
              </tr>
            </thead>
            <tbody>
              {months.map((p, i) => {
                const v = monthValues[i];
                const before = i > 0 ? monthValues[i - 1] : null;
                return (
                  <tr key={p.start}>
                    <td>{formatMonth(p.start)}</td>
                    <td className="r num">{v == null ? '—' : def.format(v)}</td>
                    <td className="r num muted">{v != null && before != null ? signed(v - before, def) : ''}</td>
                    <td className="muted">{rows.filter((r) => r.date >= p.start && r.date <= p.end && r.values[metric] != null).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : null}

      <Compare rows={rows} first={metric} openDay={openDay} />
    </>
  );
}

/** Lowercase a label unless it's an abbreviation like HRV. */
const lower = (label: string) => (/^[A-Z]{2,}/.test(label) ? label : label[0]!.toLowerCase() + label.slice(1));

function rowsMean(rows: PageProps['rows'], key: MetricKey, from: string, to: string): number | null {
  const v = rows.filter((r) => r.date >= from && r.date <= to).flatMap((r) => (r.values[key] != null ? [r.values[key]!] : []));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function signed(diff: number, def: (typeof METRICS)[MetricKey]): string {
  const d = def.key === 'asleep' ? Math.round(diff * 60) : def.key === 'strain' ? Math.round(diff * 10) / 10 : Math.round(diff);
  if (d === 0) return '±0';
  const unit = def.key === 'asleep' || def.key === 'bedtime' ? ' min' : '';
  return `${d > 0 ? '+' : '−'}${Math.abs(d)}${unit}`;
}

function missingHint(key: MetricKey): string {
  if (['steps', 'zoneMinutes', 'energy', 'spo2', 'breathing', 'skinTemp'].includes(key)) {
    return ' These numbers reach the website once the phone app with the website update has synced.';
  }
  if (['caloriesIn', 'protein', 'weight'].includes(key)) return ' Tell the coach what you ate or weighed and it shows up here.';
  return '';
}

/** Does one thing go with another? E.g. strain against next morning's recovery. */
function Compare({ rows, first, openDay }: { rows: PageProps['rows']; first: MetricKey; openDay: (d: string) => void }) {
  const [x, setX] = useState<MetricKey>(first === 'recovery' ? 'strain' : first);
  const [y, setY] = useState<MetricKey>('recovery');
  const [when, setWhen] = useState<'same' | 'next'>('next');
  const pts = pairs(rows, x, y, when === 'next');
  const f = fit(pts);
  const dx = METRICS[x];
  const dy = METRICS[y];
  const options = METRIC_ORDER.map((k) => (
    <option key={k} value={k}>
      {METRICS[k].label}
    </option>
  ));
  return (
    <Card title="Compare two things" subtitle="Each dot is a day. A link here is a pattern worth noticing, not proof that one causes the other.">
      <div className="controls">
        <label>
          <span className="muted small">Across</span>
          <select value={x} onChange={(e) => setX(e.target.value as MetricKey)}>
            {options}
          </select>
        </label>
        <label>
          <span className="muted small">Up</span>
          <select value={y} onChange={(e) => setY(e.target.value as MetricKey)}>
            {options}
          </select>
        </label>
        <Segmented
          label="Which day"
          value={when}
          onChange={setWhen}
          options={[
            { value: 'same', label: 'Same day' },
            { value: 'next', label: 'Next day' },
          ]}
        />
      </div>
      {f ? (
        <p className="finding">
          Across {f.n} days, {describeR(f.r)} (r = {f.r.toFixed(2)})
          {Math.abs(f.r) >= 0.1
            ? `: days with higher ${lower(dx.label)} tend to ${when === 'next' ? 'be followed by' : 'come with'} ${f.r > 0 ? 'higher' : 'lower'} ${lower(dy.label)}.`
            : `: ${lower(dx.label)} doesn't tell you much about ${when === 'next' ? "the next day's " : ''}${lower(dy.label)}.`}
        </p>
      ) : null}
      {pts.length >= 5 ? (
        <Scatter
          points={pts}
          fit={f}
          color={dy.color}
          xLabel={dx.label}
          yLabel={when === 'next' ? `${dy.label}, next day` : dy.label}
          xFormat={dx.format}
          yFormat={dy.format}
          xZero={dx.zeroBased}
          yZero={dy.zeroBased}
          onPick={openDay}
          summary={`${dx.label} against ${dy.label} over ${pts.length} days.`}
        />
      ) : (
        <Empty>Not enough days with both numbers yet (needs 5).</Empty>
      )}
    </Card>
  );
}
