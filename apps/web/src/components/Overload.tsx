import { liftProgress, MUSCLE_LABELS, muscleProgress, type ExerciseProgress, type ExerciseSession, type Muscle, type MuscleStatus } from '@fitness/scoring';
import { useMemo, useState } from 'react';

import type { Workout } from '../lib/data';
import { formatDate, formatNumber, formatShort } from '../lib/format';
import { TimeChart } from './charts/TimeChart';
import { Card, DayLink, Empty } from './ui';

const STATUS: Record<MuscleStatus, { label: string; tone: 'good' | 'bad' | 'neutral' }> = {
  progressing: { label: '↑ Progressing', tone: 'good' },
  holding: { label: '→ Holding', tone: 'neutral' },
  dropping: { label: '↓ Slipping', tone: 'bad' },
  mixed: { label: '↕ Mixed', tone: 'neutral' },
  new: { label: 'Only 1 session', tone: 'neutral' },
};

function Badge({ status }: { status: MuscleStatus }) {
  const s = STATUS[status];
  return <span className={`badge ${s.tone}`}>{s.label}</span>;
}

function bestSet(e: ExerciseProgress, s: ExerciseSession): string {
  if (e.bodyweight) return `${s.best.reps ?? 0} reps`;
  return `${formatNumber(s.best.kg ?? 0, s.best.kg && s.best.kg % 1 ? 1 : 0)} kg${s.best.reps ? ` × ${s.best.reps}` : ''}`;
}

function changeText(e: ExerciseProgress): string {
  if (e.change == null) return '—';
  const first = e.sessions[0]!;
  const latest = e.sessions.at(-1)!;
  if (e.bodyweight) {
    const d = latest.measure - first.measure;
    return d === 0 ? '±0 reps' : `${d > 0 ? '+' : '−'}${Math.abs(d)} reps`;
  }
  const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±');
  // Same reps: the weight change says it plainly. Different reps: compare the estimated max.
  if (first.best.reps === latest.best.reps && first.best.kg != null && latest.best.kg != null) {
    const d = latest.best.kg - first.best.kg;
    return `${sign(d)}${formatNumber(Math.abs(d), d % 1 ? 1 : 0)} kg`;
  }
  return `${sign(e.change)}${formatNumber(Math.abs(e.change), 1)}% est. max`;
}

/**
 * Which exercises, and which muscles, got stronger over the picked range: each exercise's best set
 * in its first session against its latest, plus how often a session beat every one before it.
 */
export function Overload({ workouts, dates, openDay }: { workouts: Workout[]; dates: string[]; openDay: (d: string) => void }) {
  const exercises = useMemo(
    () => liftProgress(workouts.filter((w) => w.exercises.length).map((w) => ({ date: w.date, exercises: w.exercises }))),
    [workouts],
  );
  const muscles = useMemo(() => muscleProgress(exercises), [exercises]);
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  if (!exercises.length) {
    return (
      <Card title="Progressive overload">
        <Empty>
          No sets logged in this range. Tell the coach your sets with weights, e.g. “push day 6:10–7:05 pm, bench 3×8 at 60 kg, overhead press
          3×6 at 35 kg”, and each exercise and muscle shows up here.
        </Empty>
      </Card>
    );
  }

  const tracked = exercises.filter((e) => e.status !== 'new');
  const up = tracked.filter((e) => e.status === 'progressing');
  const musclesUp = muscles.filter((m) => m.status === 'progressing').map((m) => MUSCLE_LABELS[m.muscle]);
  const musclesDown = muscles.filter((m) => m.status === 'dropping' || m.status === 'mixed').map((m) => MUSCLE_LABELS[m.muscle]);
  const musclesFlat = muscles.filter((m) => m.status === 'holding').map((m) => MUSCLE_LABELS[m.muscle]);
  const shown = muscle ? exercises.filter((e) => e.muscle === muscle) : exercises;
  const selected = exercises.find((e) => e.key === picked) ?? null;

  return (
    <>
      <Card
        title="Progressive overload"
        subtitle="Did your best set get better? Each exercise's first session in this range against its latest. Weight and reps are compared on one scale (estimated max: 60 kg × 8 ≈ 65 kg × 5); bodyweight moves compare reps."
      >
        <p className="finding">
          {tracked.length
            ? `You overloaded ${up.length} of ${tracked.length} exercises you did more than once.`
            : 'Every exercise has only one session in this range so far; do each one again to see progress.'}
          {musclesUp.length ? ` Moving up: ${musclesUp.join(', ')}.` : ''}
          {musclesFlat.length ? ` Holding: ${musclesFlat.join(', ')}.` : ''}
          {musclesDown.length ? ` Slipping somewhere: ${musclesDown.join(', ')}.` : ''}
        </p>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Muscle</th>
                <th>Overload</th>
                <th className="r">Exercises up</th>
                <th className="r">Days trained</th>
                <th className="r">Sets</th>
              </tr>
            </thead>
            <tbody>
              {muscles.map((m) => (
                <tr key={m.muscle} className={muscle === m.muscle ? 'selected' : undefined}>
                  <td>
                    <button type="button" className="link" onClick={() => setMuscle(muscle === m.muscle ? null : m.muscle)} aria-pressed={muscle === m.muscle}>
                      {MUSCLE_LABELS[m.muscle]}
                    </button>
                  </td>
                  <td>
                    <Badge status={m.status} />
                  </td>
                  <td className="r num">{m.tracked ? `${m.progressing} of ${m.tracked}` : '—'}</td>
                  <td className="r num">{m.days}</td>
                  <td className="r num">{m.sets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Click a muscle to see only its exercises. Muscles are worked out from the exercise name; “Other” means a name it didn't recognise.
        </p>
      </Card>

      <Card
        title={muscle ? `${MUSCLE_LABELS[muscle]} exercises` : 'Exercises'}
        subtitle="Click an exercise for its session-by-session chart. A new best is a session that beat every earlier one: that's an overload."
        action={
          muscle ? (
            <button type="button" className="link" onClick={() => setMuscle(null)}>
              Show all
            </button>
          ) : undefined
        }
      >
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Exercise</th>
                <th>Muscle</th>
                <th className="r">Sessions</th>
                <th className="r">First best set</th>
                <th className="r">Latest best set</th>
                <th className="r">Change</th>
                <th className="r">New bests</th>
                <th>Overload</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.key} className={picked === e.key ? 'selected' : undefined}>
                  <td>
                    <button type="button" className="link" onClick={() => setPicked(picked === e.key ? null : e.key)} aria-expanded={picked === e.key}>
                      {e.name}
                    </button>
                  </td>
                  <td className="muted">{MUSCLE_LABELS[e.muscle]}</td>
                  <td className="r num">{e.sessions.length}</td>
                  <td className="r num">{bestSet(e, e.sessions[0]!)}</td>
                  <td className="r num">{bestSet(e, e.sessions.at(-1)!)}</td>
                  <td className="r num">{changeText(e)}</td>
                  <td className="r num" title={e.lastNewBest ? `Last one ${formatDate(e.lastNewBest)}` : undefined}>
                    {e.sessions.length > 1 ? e.newBests : '—'}
                  </td>
                  <td>
                    <Badge status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected ? <ExerciseChart exercise={selected} dates={dates} openDay={openDay} /> : null}
      </Card>
    </>
  );
}

function ExerciseChart({ exercise: e, dates, openDay }: { exercise: ExerciseProgress; dates: string[]; openDay: (d: string) => void }) {
  const byDate = new Map(e.sessions.map((s) => [s.date, s]));
  const unit = e.bodyweight ? 'reps' : 'kg';
  const fmt = (v: number) => (e.bodyweight ? `${Math.round(v)} reps` : `${formatNumber(v, 1)} kg est. max`);
  const latest = e.sessions.at(-1)!;
  return (
    <div className="exercise-chart">
      <h3>
        {e.name} <span className="muted small">· {e.bodyweight ? 'most reps in a set' : 'estimated max of the best set'}, each session</span>
      </h3>
      <TimeChart
        dates={dates}
        height={220}
        zeroBased={false}
        yFormat={(v) => `${formatNumber(v, v % 1 ? 1 : 0)}${e.bodyweight ? '' : ' kg'}`}
        onPick={openDay}
        summary={`${e.name}: from ${fmt(e.sessions[0]!.measure)} to ${fmt(latest.measure)} over ${e.sessions.length} sessions.`}
        series={[
          {
            kind: 'line',
            label: e.bodyweight ? 'Most reps' : 'Estimated max',
            color: 'var(--strain)',
            values: dates.map((d) => byDate.get(d)?.measure ?? null),
            format: (v) => fmt(v),
            connectGaps: true,
            dots: true,
          },
        ]}
      />
      <p className="muted small">
        {e.newBests
          ? `${e.newBests} new ${e.newBests === 1 ? 'best' : 'bests'} in ${e.sessions.length} sessions, the last on `
          : `No new best yet in ${e.sessions.length} sessions. `}
        {e.lastNewBest ? (
          <DayLink date={e.lastNewBest} onPick={openDay}>
            {formatShort(e.lastNewBest)}
          </DayLink>
        ) : null}
        {e.lastNewBest ? '.' : ''} Latest: {bestSet(e, latest)}, {latest.sets} sets{e.bodyweight ? '' : `, ${formatNumber(latest.volume)} ${unit} moved in total`}.
      </p>
    </div>
  );
}
