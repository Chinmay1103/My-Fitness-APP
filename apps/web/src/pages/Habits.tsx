import { habitImpact } from '@fitness/scoring';

import { Card, Empty } from '../components/ui';
import { formatDelta } from '../lib/format';
import { denseScores, habitsIn } from '../lib/stats';
import type { PageProps } from './types';

function Diff({ v }: { v: number | null }) {
  if (v == null) return <span className="muted">not enough days</span>;
  const tone = Math.abs(v) < 2 ? 'neutral' : v > 0 ? 'good' : 'bad';
  return <span className={`num ${tone}`}>{formatDelta(v)} {Math.abs(v) === 1 ? 'point' : 'points'}</span>;
}

export function Habits({ data, rows }: PageProps) {
  const entries = habitsIn(data, rows);
  const impacts = habitImpact(entries, denseScores(rows), rows.length);
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);

  return (
    <>
      <Card
        title="What your habits do to the next morning"
        subtitle="For each habit you told the coach about: next-morning recovery and that night's sleep score after days with it, against days without. A longer range gives a surer answer."
      >
        {impacts.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Habit</th>
                <th className="r">Days with it</th>
                <th className="r">Next-morning recovery</th>
                <th className="r">Sleep score</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {impacts.map((h) => (
                <tr key={h.kind}>
                  <td className="cap">{h.kind}</td>
                  <td className="r num">{counts.get(h.kind) ?? h.daysWith}</td>
                  <td className="r">
                    <Diff v={h.recoveryDiff} />
                  </td>
                  <td className="r">
                    <Diff v={h.sleepDiff} />
                  </td>
                  <td className="muted small">{h.early ? 'early hint' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No habits logged in this range. Mention drinks, late coffee, a late dinner or stress to the coach and they show up here.</Empty>
        )}
        <p className="muted small">
          Needs at least 3 days with and without a habit; under 6 days with it, treat the number as a hint. These are links, not proof
          of cause: a late dinner and a bad night can both come from a busy day.
        </p>
      </Card>
    </>
  );
}
