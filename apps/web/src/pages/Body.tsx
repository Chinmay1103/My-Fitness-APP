import { Legend, TimeChart } from '../components/charts/TimeChart';
import { Card, Empty, StatTile } from '../components/ui';
import { formatDate, formatNumber } from '../lib/format';
import { METRICS, type MetricKey } from '../lib/metrics';
import { rollingMean, summarize } from '../lib/stats';
import type { PageProps } from './types';

/** One small chart per body or food number, each on its own axis (no shared or dual scales). */
function Small({ k, rows, openDay, openTrend }: { k: MetricKey } & Pick<PageProps, 'rows' | 'openDay' | 'openTrend'>) {
  const def = METRICS[k];
  const values = rows.map((r) => r.values[k]);
  const sum = summarize(rows, k);
  const bars = k === 'caloriesIn' || k === 'protein' || k === 'steps';
  return (
    <Card
      title={def.label}
      subtitle={sum.avg != null ? `Average ${def.format(sum.avg)} over ${formatNumber(sum.count)} days` : def.about}
      action={
        <button type="button" className="link" onClick={() => openTrend(k)}>
          Full trend ›
        </button>
      }
    >
      {sum.count ? (
        <TimeChart
          dates={rows.map((r) => r.date)}
          height={180}
          zeroBased={def.zeroBased}
          yFormat={(v) => v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          onPick={openDay}
          summary={`${def.label}, averaging ${sum.avg == null ? 'no value' : def.format(sum.avg)}.`}
          series={
            bars
              ? [{ kind: 'bars', label: def.label, color: def.color, values, format: def.format }]
              : [{ kind: 'line', label: def.label, color: def.color, values, format: def.format, connectGaps: def.sparse }]
          }
        />
      ) : (
        <Empty>
          Nothing yet.{' '}
          {k === 'caloriesIn' || k === 'protein' || k === 'weight'
            ? 'Tell the coach what you ate or weighed.'
            : 'It reaches the website once the updated phone app has synced.'}
        </Empty>
      )}
    </Card>
  );
}

export function Body({ data, rows, prevRows, openDay, openTrend }: PageProps) {
  const from = rows[0]!.date;
  const to = rows.at(-1)!.date;
  const weighIns = data.weights.filter((w) => w.date >= from && w.date <= to);
  const firstW = weighIns[0];
  const lastW = weighIns.at(-1);
  const weightValues = rows.map((r) => r.values.weight);
  const smooth = rollingMean(weightValues, 14, 1);

  return (
    <>
      <div className="tiles">
        <StatTile def={METRICS.weight} value={lastW?.kg ?? null} previous={firstW && lastW && firstW !== lastW ? firstW.kg : null} note="latest weigh-in" vs="first weigh-in in range" onClick={() => openTrend('weight')} />
        <StatTile def={METRICS.caloriesIn} value={summarize(rows, 'caloriesIn').avg} previous={summarize(prevRows, 'caloriesIn').avg} onClick={() => openTrend('caloriesIn')} />
        <StatTile def={METRICS.protein} value={summarize(rows, 'protein').avg} previous={summarize(prevRows, 'protein').avg} onClick={() => openTrend('protein')} />
        <StatTile def={METRICS.energy} value={summarize(rows, 'energy').avg} previous={summarize(prevRows, 'energy').avg} onClick={() => openTrend('energy')} />
      </div>

      <Card title="Weight" subtitle="Each weigh-in, and a 14-day average that smooths out water and food swings.">
        {weighIns.length ? (
          <>
            <TimeChart
              dates={rows.map((r) => r.date)}
              height={240}
              zeroBased={false}
              yFormat={(v) => v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              onPick={openDay}
              summary={`Weight from ${firstW!.kg} to ${lastW!.kg} kg.`}
              series={[
                { kind: 'line', label: 'Weigh-in', color: 'var(--weight)', values: weightValues, format: METRICS.weight.format, faint: true, connectGaps: true },
                { kind: 'line', label: '14-day average', color: 'var(--weight)', values: smooth, format: METRICS.weight.format, connectGaps: true },
              ]}
            />
            <Legend
              items={[
                { label: 'Weigh-in', color: 'var(--weight)', shape: 'line' },
                { label: '14-day average', color: 'var(--weight)', shape: 'line' },
              ]}
            />
          </>
        ) : (
          <Empty>No weigh-ins in this range. Tell the coach your weight ("61.1 kg this morning").</Empty>
        )}
      </Card>

      <div className="grid-2">
        {(['caloriesIn', 'protein', 'steps', 'energy', 'spo2', 'breathing', 'skinTemp', 'hrAvg'] as MetricKey[]).map((k) => (
          <Small key={k} k={k} rows={rows} openDay={openDay} openTrend={openTrend} />
        ))}
      </div>
    </>
  );
}
