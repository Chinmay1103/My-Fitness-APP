import { liftProgress, MUSCLE_LABELS, type ExerciseProgress } from '@fitness/scoring';
import { useEffect, useMemo, useState } from 'react';

import { Legend, TimeChart } from '../components/charts/TimeChart';
import { Card, DayLink, Empty, Segmented } from '../components/ui';
import type { Goals } from '../lib/data';
import { addDays, dateRange, localMinutes, toMs, weekStart } from '../lib/dates';
import { formatClock, formatDate, formatDelta, formatMinutes, formatNumber, formatShort } from '../lib/format';
import type { Row } from '../lib/metrics';
import {
  exerciseSessions,
  foodDays,
  foodHits,
  goalTrack,
  TOP_OF_RANGE,
  weeklyRate,
  weeklyWeights,
  weeksToGoal,
  weightLines,
  workoutGroup,
  type FoodDay,
  type GoalTrack,
  type WorkoutGroup,
} from '../lib/progress';
import { mean } from '../lib/stats';
import type { PageProps } from './types';

type Tab = 'weight' | 'food' | 'strength' | 'training';

const TABS: { value: Tab; label: string }[] = [
  { value: 'weight', label: 'Weight' },
  { value: 'food', label: 'Food' },
  { value: 'strength', label: 'Strength' },
  { value: 'training', label: 'Training log' },
];

const kg = (v: number, d = 1) => `${formatNumber(v, d)} kg`;
const kgSet = (v: number) => formatNumber(v, v % 1 ? 1 : 0);

function useTab(): [Tab, (t: Tab) => void] {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const t = localStorage.getItem('myfitness.progressTab') as Tab | null;
      return t && TABS.some((x) => x.value === t) ? t : 'weight';
    } catch {
      return 'weight';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('myfitness.progressTab', tab);
    } catch {
      // Not remembered in a private window; fine.
    }
  }, [tab]);
  return [tab, setTab];
}

/**
 * Road to the goal: weight against the goal weight, food against the daily targets, each lift's
 * sets session by session, and a training calendar. Goals come from what the user told the coach.
 */
export function Progress({ data, rows, openDay }: PageProps) {
  const [tab, setTab] = useTab();
  const from = rows[0]!.date;
  const to = rows.at(-1)!.date;
  const goals = data.goals;
  const workouts = useMemo(() => data.workouts.filter((w) => w.date >= from && w.date <= to), [data.workouts, from, to]);
  const food = useMemo(() => foodDays(rows, data.meals, goals), [rows, data.meals, goals]);
  const hits = foodHits(food, goals);
  const track = goalTrack(rows, goals.weightKg);
  const rate = weeklyRate(rows);
  const gym = workouts.filter((w) => w.exercises.length).length;

  return (
    <>
      <GoalHero track={track} goals={goals} />

      <div className="tiles">
        <Fact
          value={track ? `${formatDelta(track.now - track.start, 1)} kg` : '—'}
          label="7-day average, start of range to now"
        />
        <Fact value={rate != null ? `${formatDelta(rate, 2)} kg` : '—'} label={rate != null ? 'a week, trend through every weigh-in' : 'trend needs 5 weigh-ins'} />
        <Fact
          value={hits.avgCalories != null ? `${formatNumber(Math.round(hits.avgCalories / 10) * 10)} kcal` : '—'}
          label={`average on ${formatNumber(hits.days)} fully logged days${goals.calories ? ` · target ${formatNumber(goals.calories)}` : ''}`}
        />
        <Fact
          value={hits.avgProtein != null ? `${formatNumber(hits.avgProtein)} g` : '—'}
          label={`protein on those days${goals.proteinG ? ` · target ${goals.proteinG} g` : ''}`}
        />
        <Fact value={formatNumber(gym)} label="gym sessions with sets logged" />
      </div>

      <div className="tabs no-print" role="tablist" aria-label="Progress section">
        {TABS.map((t) => (
          <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} className={tab === t.value ? 'tab on' : 'tab'} onClick={() => setTab(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'weight' ? <WeightTab rows={rows} track={track} rate={rate} openDay={openDay} /> : null}
      {tab === 'food' ? <FoodTab rows={rows} food={food} goals={goals} timeZone={data.timeZone} openDay={openDay} /> : null}
      {tab === 'strength' ? <StrengthTab workouts={workouts} openDay={openDay} /> : null}
      {tab === 'training' ? <TrainingTab rows={rows} workouts={workouts} openDay={openDay} /> : null}
    </>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <span className="stat-value num">{value}</span>
      <span className="stat-delta neutral">{label}</span>
    </div>
  );
}

/** The bar from where the range started to the goal, with a pin at today's 7-day average. */
function GoalHero({ track, goals }: { track: GoalTrack | null; goals: Goals }) {
  if (!track) {
    return (
      <Card title={goals.weightKg ? 'Road to your goal' : 'Set a goal'}>
        <Empty>
          {goals.weightKg
            ? `Goal: ${kg(goals.weightKg)}. No weigh-ins in this range yet; tell the coach your weight ("60.7 kg this morning").`
            : 'Tell the coach your goal, e.g. “my goal is 65 kg, eating 2,400 kcal and 110 g protein a day”. This page then measures you against it.'}
        </Empty>
      </Card>
    );
  }
  const pct = `${(track.done * 100).toFixed(1)}%`;
  const left = Math.abs(track.remaining) < 0.05 ? 'Goal reached' : `${kg(Math.abs(track.remaining))} to ${track.direction === 'gain' ? 'gain' : 'lose'}`;
  return (
    <section className="card hero" aria-label={`From ${kg(track.start)} to ${kg(track.goal)}; now ${kg(track.now)}, ${left}.`}>
      <p className="hero-title">
        Road to <span className="num">{formatNumber(track.goal, track.goal % 1 ? 1 : 0)}</span> kg
        <span className="muted small"> · {left}</span>
      </p>
      <div className="rail">
        <div className="rail-fill" style={{ width: pct }} />
        <div className="rail-pin" style={{ left: pct }} />
        <div className="rail-pin goal" style={{ left: '100%' }} />
      </div>
      <div className="rail-marks">
        <span>
          <b className="num">{formatNumber(track.start, 1)}</b>
          start of range
        </span>
        {/* Kept clear of the start and goal labels at the ends. */}
        <span className="now" style={{ left: `${Math.min(80, Math.max(20, track.done * 100))}%` }}>
          <b className="num">{formatNumber(track.now, 1)}</b>
          7-day average now
        </span>
        <span className="end">
          <b className="num">{formatNumber(track.goal, 1)}</b>
          goal
        </span>
      </div>
    </section>
  );
}

/* Weight ---------------------------------------------------------------------------------- */

type WeightView = 'both' | 'daily' | 'avg';

function WeightTab({ rows, track, rate, openDay }: { rows: Row[]; track: GoalTrack | null; rate: number | null; openDay: (d: string) => void }) {
  const [view, setView] = useState<WeightView>('both');
  const lines = weightLines(rows);
  const weeks = weeklyWeights(rows).reverse();
  const count = lines.daily.filter((v) => v != null).length;
  if (!count) {
    return (
      <Card title="Morning weight">
        <Empty>No weigh-ins in this range. Tell the coach your weight each morning (“60.7 kg”).</Empty>
      </Card>
    );
  }
  const series = [
    ...(view !== 'avg' ? [{ kind: 'line' as const, label: 'Weigh-in', color: 'var(--weight)', values: lines.daily, format: (v: number) => kg(v, 2), faint: true, connectGaps: true }] : []),
    ...(view !== 'daily' ? [{ kind: 'line' as const, label: '7-day average', color: 'var(--weight)', values: lines.avg, format: (v: number) => kg(v, 2), connectGaps: true }] : []),
  ];
  return (
    <>
      <Card
        title="Morning weight"
        subtitle="Single weigh-ins swing with water and food; the 7-day average is the number to trust."
        action={<Segmented label="Show" value={view} onChange={setView} options={[{ value: 'both', label: 'Both' }, { value: 'daily', label: 'Daily' }, { value: 'avg', label: '7-day avg' }]} />}
      >
        <TimeChart
          dates={rows.map((r) => r.date)}
          height={300}
          zeroBased={false}
          yFormat={(v) => `${formatNumber(v, v % 1 ? 1 : 0)} kg`}
          onPick={openDay}
          summary={`${count} weigh-ins${track ? `, 7-day average from ${kg(track.start)} to ${kg(track.now)}` : ''}.`}
          series={series}
        />
        {view === 'both' ? (
          <Legend
            items={[
              { label: 'Weigh-in', color: 'color-mix(in srgb, var(--weight) 40%, transparent)', shape: 'line' },
              { label: '7-day average', color: 'var(--weight)', shape: 'line' },
            ]}
          />
        ) : null}
      </Card>
      <div className="grid-2">
        <Card title="Weekly averages" subtitle="Monday to Sunday, newest first.">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Week of</th>
                  <th className="r">Average</th>
                  <th className="r">Change</th>
                  <th className="r">Weigh-ins</th>
                </tr>
              </thead>
              <tbody>
                {weeks.slice(0, 16).map((w) => (
                  <tr key={w.start}>
                    <td>{formatShort(w.start)}</td>
                    <td className="r num">{formatNumber(w.avg, 2)}</td>
                    <td className="r num">{w.change == null ? '—' : formatDelta(w.change, 2)}</td>
                    <td className="r num">{w.readings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {track ? <Projector track={track} rate={rate} /> : <Card title="When would you reach it?"><Empty>Tell the coach your goal weight to see this.</Empty></Card>}
      </div>
    </>
  );
}

const MONTH_YEAR = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });

/** Drag a weekly rate; see the month the goal would be reached from today's 7-day average. */
function Projector({ track, rate }: { track: GoalTrack; rate: number | null }) {
  const towards = rate != null && Math.sign(rate) === Math.sign(track.remaining) ? Math.abs(rate) : null;
  const [pick, setPick] = useState(() => Math.min(0.75, Math.max(0.1, Math.round((towards ?? 0.25) * 20) / 20)));
  const weeks = weeksToGoal(track.now, track.goal, pick);
  const when = MONTH_YEAR.format(Date.now() + weeks * 7 * 86_400_000);
  const verb = track.direction === 'gain' ? 'gain' : 'loss';
  let note: string;
  if (towards == null) note = `Your trend isn't moving towards the goal yet${rate != null ? ` (${formatDelta(rate, 2)} kg a week)` : ''}.`;
  else if (pick < towards - 0.025) note = `Slower than your trend so far (${formatNumber(towards, 2)} kg a week).`;
  else if (pick <= towards + 0.05) note = 'About your pace so far.';
  else note = `Faster than your trend (${formatNumber(towards, 2)} kg a week); it takes more consistent days than you've had.`;
  if (track.direction === 'gain' && pick > 0.5) note += ' Above about 0.5 kg a week, more of the gain tends to be fat.';
  if (track.direction === 'lose' && pick > 0.75) note += ' Faster than about 0.75 kg a week, muscle is harder to keep.';
  return (
    <Card title="When would you reach it?" subtitle={`Drag a weekly rate of ${verb}, from today's 7-day average.`}>
      {Math.abs(track.remaining) < 0.05 ? (
        <p className="finding">You're there: the 7-day average is at the goal.</p>
      ) : (
        <>
          <input type="range" className="range" min={0.1} max={1} step={0.05} value={pick} onChange={(e) => setPick(Number(e.target.value))} aria-label={`Weekly ${verb} in kg`} />
          <div className="projector">
            <span>
              <span className="big num">{formatNumber(pick, 2)}</span> kg a week
            </span>
            <span className="r">
              <span className="big num">{when}</span>
              <br />
              <span className="muted small">about {formatNumber(Math.round(weeks))} weeks</span>
            </span>
          </div>
          <p className="muted small">{note}</p>
        </>
      )}
    </Card>
  );
}

/* Food ------------------------------------------------------------------------------------ */

function FoodTab({ rows, food, goals, timeZone, openDay }: { rows: Row[]; food: FoodDay[]; goals: Goals; timeZone: string | undefined; openDay: (d: string) => void }) {
  const [mode, setMode] = useState<'kcal' | 'protein'>('kcal');
  const [picked, setPicked] = useState<string | null>(null);
  const hits = foodHits(food, goals);
  if (!food.length) {
    return (
      <Card title="Daily intake">
        <Empty>No meals logged in this range. Tell the coach what you ate and it estimates the calories and protein.</Empty>
      </Card>
    );
  }
  const byDate = new Map(food.map((f) => [f.date, f]));
  const isK = mode === 'kcal';
  const target = isK ? goals.calories : goals.proteinG;
  const color = isK ? 'var(--calories)' : 'var(--recovery)';
  const fmt = (v: number) => (isK ? `${formatNumber(v)} kcal` : `${formatNumber(v)} g`);
  const shown = byDate.get(picked ?? '') ?? food.at(-1)!;
  const full = food.filter((f) => !f.partial);
  const gap = target != null && full.length ? target - mean(full.map((f) => (isK ? f.calories : f.protein)))! : null;

  return (
    <>
      <Card
        title="Daily intake"
        subtitle="Click a bar to see what you ate that day. Faded bars were only partly logged and are left out of the averages."
        action={<Segmented label="Show" value={mode} onChange={setMode} options={[{ value: 'kcal', label: 'Calories' }, { value: 'protein', label: 'Protein' }]} />}
      >
        <TimeChart
          dates={rows.map((r) => r.date)}
          height={300}
          yFormat={(v) => formatNumber(v)}
          onPick={setPicked}
          summary={`${isK ? 'Calories' : 'Protein'} on ${food.length} logged days${target ? `, target ${fmt(target)}` : ''}.`}
          series={[
            {
              kind: 'bars',
              label: isK ? 'Calories' : 'Protein',
              color,
              values: rows.map((r) => {
                const f = byDate.get(r.date);
                return f ? (isK ? f.calories : f.protein) : null;
              }),
              colors: rows.map((r) => (byDate.get(r.date)?.partial ? 'var(--track)' : null)),
              colorLabels: rows.map((r) => (byDate.get(r.date)?.partial ? 'partly logged' : null)),
              format: fmt,
            },
            ...(target != null ? [{ kind: 'line' as const, label: 'Target', color: 'var(--muted)', values: rows.map(() => target), format: fmt }] : []),
          ]}
        />
        <Legend
          items={[
            { label: 'Fully logged day', color, shape: 'square' },
            { label: 'Partly logged', color: 'var(--track)', shape: 'square' },
            ...(target != null ? [{ label: `Target ${fmt(target)}`, color: 'var(--muted)', shape: 'line' as const }] : []),
          ]}
        />
      </Card>
      <div className="grid-2">
        <Card
          title={formatDate(shown.date)}
          subtitle={`${formatNumber(shown.calories)} kcal · ${formatNumber(shown.protein)} g protein · ${shown.meals.length} ${shown.meals.length === 1 ? 'meal' : 'meals'}`}
          action={<FoodBadge day={shown} goals={goals} />}
          className="meal-card"
        >
          <ul className="meals">
            {shown.meals.map((m) => (
              <li key={m.id}>
                <span className="muted small num">{formatClock(localMinutes(m.eatenAt, timeZone))}</span>
                <span>{m.description ?? 'Meal'}</span>
                <span className="muted small r">
                  {m.calories != null ? `${formatNumber(m.calories)} kcal` : ''}
                  {m.proteinG != null ? ` · ${formatNumber(m.proteinG)} g` : ''}
                </span>
              </li>
            ))}
          </ul>
          <DayLink date={shown.date} onPick={openDay}>
            Open the whole day
          </DayLink>
        </Card>
        <Card title={`Hit rate on ${hits.days} fully logged days`} subtitle={hits.partial ? `${hits.partial} partly logged ${hits.partial === 1 ? 'day' : 'days'} left out.` : undefined}>
          <table className="table">
            <tbody>
              <tr>
                <td>Calories at {goals.calories ? `${formatNumber(goals.calories)}+` : 'target'}</td>
                <td className="r num">{hits.calorieHits != null ? `${hits.calorieHits} / ${hits.days}` : 'no target set'}</td>
              </tr>
              <tr>
                <td>Protein at {goals.proteinG ? `${goals.proteinG} g+` : 'target'}</td>
                <td className="r num">{hits.proteinHits != null ? `${hits.proteinHits} / ${hits.days}` : 'no target set'}</td>
              </tr>
              <tr>
                <td>Average calories</td>
                <td className="r num">{hits.avgCalories != null ? formatNumber(hits.avgCalories) : '—'}</td>
              </tr>
              <tr>
                <td>Average protein</td>
                <td className="r num">{hits.avgProtein != null ? `${formatNumber(hits.avgProtein)} g` : '—'}</td>
              </tr>
            </tbody>
          </table>
          {gap != null ? (
            <p className="muted small">
              {gap > 0
                ? `On average ${fmt(Math.round(gap))} a day under the ${isK ? 'calorie' : 'protein'} target.`
                : `On average ${fmt(Math.round(-gap))} a day over the ${isK ? 'calorie' : 'protein'} target.`}
            </p>
          ) : (
            <p className="muted small">Tell the coach your daily calorie and protein targets to see how often you hit them.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function FoodBadge({ day, goals }: { day: FoodDay; goals: Goals }) {
  if (day.partial) return <span className="badge">Partly logged</span>;
  if (goals.calories == null) return null;
  const share = day.calories / goals.calories;
  if (share >= 1) return <span className="badge good">On target</span>;
  if (share >= 0.85) return <span className="badge neutral">A bit short</span>;
  return <span className="badge bad">Well short</span>;
}

/* Strength -------------------------------------------------------------------------------- */

const STATUS = {
  progressing: { label: '↑ Progressing', tone: 'good' },
  holding: { label: '→ Holding', tone: 'neutral' },
  dropping: { label: '↓ Slipping', tone: 'bad' },
  new: { label: 'Only 1 session', tone: 'neutral' },
} as const;

function setText(s: { reps: number | null; weightKg: number | null }) {
  return s.weightKg ? `${kgSet(s.weightKg)} kg × ${s.reps ?? 1}` : `${s.reps ?? 0} reps`;
}

function advice(e: ExerciseProgress, ready: boolean, latestTop: string): string {
  if (ready) return `Every set at the top weight reached ${TOP_OF_RANGE}+ reps last time (${latestTop}): go up a step next session.`;
  const first = e.sessions[0]!;
  const latest = e.sessions.at(-1)!;
  const b = (s: typeof first) => (e.bodyweight ? `${s.best.reps ?? 0} reps` : `${kgSet(s.best.kg ?? 0)} kg × ${s.best.reps ?? 1}`);
  switch (e.status) {
    case 'progressing':
      return `Best set went from ${b(first)} to ${b(latest)}. Keep adding reps at this weight until every set reaches ${TOP_OF_RANGE}, then add weight.`;
    case 'holding':
      return `Best set is about where it started (${b(latest)}). Push for one more rep per set before adding weight.`;
    case 'dropping':
      return `Best set is below where it started (${b(first)} then, ${b(latest)} now). Check sleep and recovery; or drop a step and build back up.`;
    default:
      return 'Only one session in this range; do it again to see progress.';
  }
}

function StrengthTab({ workouts, openDay }: { workouts: PageProps['data']['workouts']; openDay: (d: string) => void }) {
  const exercises = useMemo(() => liftProgress(workouts.filter((w) => w.exercises.length).map((w) => ({ date: w.date, exercises: w.exercises }))), [workouts]);
  const [picked, setPicked] = useState<string | null>(null);
  if (!exercises.length) {
    return (
      <Card title="Lift progression">
        <Empty>No sets logged in this range. Tell the coach your sets, e.g. “chest press 25 kg × 10, 25 × 8”.</Empty>
      </Card>
    );
  }
  const e = exercises.find((x) => x.key === picked) ?? exercises[0]!;
  const sessions = exerciseSessions(workouts, e.key);
  const latest = sessions.at(-1);
  const ready = !!latest?.readyForMore;
  const status = STATUS[e.status];
  const unit = e.bodyweight ? 'reps' : 'kg';

  return (
    <Card title="Lift progression" subtitle={`Pick an exercise. The highlighted set is the best of each session. "Go up" means every set at the top weight reached ${TOP_OF_RANGE} reps (the top of an 8–12 range).`}>
      <div className="chips">
        {exercises.map((x) => (
          <button key={x.key} type="button" className={x.key === e.key ? 'chip on' : 'chip'} aria-pressed={x.key === e.key} onClick={() => setPicked(x.key)}>
            {x.name}
          </button>
        ))}
      </div>
      <div className="card-head">
        <div>
          <h2>{e.name}</h2>
          <p className="muted small">
            {MUSCLE_LABELS[e.muscle]} · {e.sessions.length} {e.sessions.length === 1 ? 'session' : 'sessions'}
            {e.newBests ? ` · ${e.newBests} new ${e.newBests === 1 ? 'best' : 'bests'}` : ''}
          </p>
        </div>
        <span className="badges">
          {ready ? <span className="badge good">Go up a step</span> : null}
          <span className={`badge ${status.tone}`}>{status.label}</span>
        </span>
      </div>
      <p>{advice(e, ready, latest ? setText(latest.sets[latest.top]!) : '')}</p>
      <div className="grid-2 flat">
        <div className="sessions">
          {[...sessions].reverse().map((s) => (
            <div key={s.date} className="session">
              <DayLink date={s.date} onPick={openDay}>
                {formatShort(s.date)}
              </DayLink>
              <div className="sets">
                {s.sets.map((set, i) => (
                  <span key={i} className={i === s.top ? 'set top num' : 'set num'}>
                    {setText(set)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div>
          <TimeChart
            dates={e.sessions.map((s) => s.date)}
            height={240}
            zeroBased={false}
            yFormat={(v) => `${formatNumber(v, 0)}${e.bodyweight ? '' : ' kg'}`}
            onPick={openDay}
            summary={`${e.name}, ${e.bodyweight ? 'most reps' : 'estimated max'} per session.`}
            series={[
              {
                kind: 'line',
                label: e.bodyweight ? 'Most reps' : 'Estimated max',
                color: 'var(--strain)',
                values: e.sessions.map((s) => s.measure),
                format: (v) => (e.bodyweight ? `${Math.round(v)} reps` : `${formatNumber(v, 1)} ${unit}`),
                connectGaps: true,
                dots: true,
              },
            ]}
          />
          <p className="muted small">
            {e.bodyweight ? 'Most reps in a set, each session.' : 'Estimated one-rep max of the best set (Epley). A rough strength signal, not a test.'}
          </p>
        </div>
      </div>
    </Card>
  );
}

/* Training -------------------------------------------------------------------------------- */

const GROUP_LABEL: Record<WorkoutGroup, string> = { upper: 'Upper body', lower: 'Lower body', cardio: 'Cardio', other: 'Other' };
const CAL_WEEKS = 8;

function TrainingTab({ rows, workouts, openDay }: { rows: Row[]; workouts: PageProps['data']['workouts']; openDay: (d: string) => void }) {
  const to = rows.at(-1)!.date;
  const from = rows[0]!.date;
  // A readable month view: the last 8 weeks of the range at most.
  const start = weekStart(from > addDays(to, -CAL_WEEKS * 7 + 1) ? from : addDays(to, -CAL_WEEKS * 7 + 1));
  const end = addDays(weekStart(to), 6);
  const byDate = new Map<string, PageProps['data']['workouts']>();
  for (const w of workouts) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
  const counts = { upper: 0, lower: 0, cardio: 0, other: 0 };
  const recent = workouts.filter((w) => w.date >= start);
  for (const w of recent) counts[workoutGroup(w)]++;
  const last7 = rows.slice(-7).reverse();

  return (
    <>
      <Card
        title="Training calendar"
        subtitle={`${start > from ? `Last ${CAL_WEEKS} weeks. ` : ''}Only workouts you told the coach about show here. Click a day to open it.`}
      >
        <div className="cal" role="grid" aria-label="Training calendar">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="dow" role="columnheader">
              {d}
            </div>
          ))}
          {dateRange(start, end).map((d) => {
            const list = byDate.get(d) ?? [];
            const out = d < from || d > to;
            const group = list.length ? workoutGroup(list[0]!) : null;
            const day = new Date(toMs(d)).getUTCDate();
            return (
              <button
                key={d}
                type="button"
                role="gridcell"
                className={`cal-day${out ? ' out' : ''}${group ? ` ${group}` : ''}`}
                disabled={out}
                onClick={() => openDay(d)}
                title={`${formatDate(d)}${list.length ? `: ${list.map((w) => w.title ?? w.kind).join(', ')}` : ''}`}
              >
                <span className="num">
                  {day}
                  {day === 1 ? ` ${formatShort(d).split(' ')[1]}` : ''}
                </span>
                {list.length ? <span className="cal-label cap">{list.map((w) => w.title ?? w.kind).join(' + ')}</span> : null}
              </button>
            );
          })}
        </div>
        <Legend
          items={(['upper', 'lower', 'cardio', 'other'] as WorkoutGroup[])
            .filter((g) => counts[g])
            .map((g) => ({ label: `${GROUP_LABEL[g]} · ${counts[g]}`, color: `var(--group-${g})`, shape: 'square' as const }))}
        />
      </Card>

      <Card title="Recovery from your band" subtitle="The last 7 days of the range. Lifting keeps heart rate low, so gym days barely show as strain; your sets are the better effort measure.">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="r">Sleep</th>
                <th>Bed → wake</th>
                <th className="r">Resting HR</th>
                <th className="r">HRV</th>
                <th className="r">Recovery</th>
                <th className="r">Strain</th>
              </tr>
            </thead>
            <tbody>
              {last7.map((r) => {
                const d = r.day;
                return (
                  <tr key={r.date}>
                    <td>
                      <DayLink date={r.date} onPick={openDay}>
                        {formatShort(r.date)}
                      </DayLink>
                    </td>
                    <td className="r num">{d?.asleep != null ? formatMinutes(d.asleep) : '—'}</td>
                    <td className="num">{d?.bedtime != null && d.wake != null ? `${formatClock(d.bedtime)} → ${formatClock(d.wake)}` : '—'}</td>
                    <td className="r num">{d?.restingHr != null ? d.restingHr : '—'}</td>
                    <td className="r num">{d?.hrv != null ? `${Math.round(d.hrv)} ms` : '—'}</td>
                    <td className="r">
                      {d?.recovery != null ? (
                        <span className={`badge zone-${d.zone}`}>{d.recovery}%</span>
                      ) : (
                        <span className="muted small">{d?.calibrating ? 'calibrating' : '—'}</span>
                      )}
                    </td>
                    <td className="r num">{d ? d.strain.toFixed(1) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
