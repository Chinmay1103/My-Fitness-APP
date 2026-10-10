import { useEffect } from 'react';

// Pure wording shared with the phone, so the "why" reads the same in both places.
import { FACTOR_LABELS, RECOVERY_GUIDANCE, recoveryFactorDetail } from '../../../mobile/lib/insights';
import type { Dataset } from '../lib/data';
import { addDays } from '../lib/dates';
import { formatClock, formatDate, formatDelta, formatMinutes, formatNumber } from '../lib/format';
import { ZONE_COLOR, zoneName } from '../lib/zones';

const timeFmt = (timeZone?: string) => new Intl.DateTimeFormat('en-IN', { timeZone, hour: 'numeric', minute: '2-digit' });

/** Everything about one day: the three scores and why, the coach note, and what was logged. */
export function DayPanel({ data, date, onClose, onPick }: { data: Dataset; date: string; onClose: () => void; onPick: (d: string) => void }) {
  const day = data.days.find((d) => d.date === date) ?? null;
  const note = data.notes.find((n) => n.date === date);
  const workouts = data.workouts.filter((w) => w.date === date);
  const meals = data.meals.filter((m) => m.date === date);
  const habits = data.habits.filter((h) => h.date === date);
  const weight = data.weights.filter((w) => w.date === date).at(-1);
  const time = timeFmt(data.timeZone);
  const s = day?.scores;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && e.altKey) onPick(addDays(date, -1));
      if (e.key === 'ArrowRight' && e.altKey) onPick(addDays(date, 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [date, onClose, onPick]);

  const calories = meals.reduce((a, m) => a + (m.calories ?? 0), 0);
  const protein = meals.reduce((a, m) => a + (m.proteinG ?? 0), 0);

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="panel" role="dialog" aria-modal="true" aria-label={formatDate(date)} onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <button type="button" className="icon-button" onClick={() => onPick(addDays(date, -1))} aria-label="Day before">
            ‹
          </button>
          <h2>{formatDate(date)}</h2>
          <button type="button" className="icon-button" onClick={() => onPick(addDays(date, 1))} aria-label="Day after">
            ›
          </button>
          <button type="button" className="icon-button close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {!day ? (
          <p className="empty">No scores synced for this day.</p>
        ) : (
          <div className="trio">
            <div>
              <span className="muted small">Recovery</span>
              <strong className="num big">{day.recovery != null ? `${day.recovery}%` : '—'}</strong>
              {day.zone ? (
                <span className="small">
                  <span className="key-square" style={{ background: ZONE_COLOR[day.zone] }} />
                  {zoneName(day.zone)}
                  {day.calibrating ? ' · calibrating' : ''}
                </span>
              ) : null}
            </div>
            <div>
              <span className="muted small">Strain</span>
              <strong className="num big">{day.strain.toFixed(1)}</strong>
            </div>
            <div>
              <span className="muted small">Sleep</span>
              <strong className="num big">{day.sleepScore != null ? `${day.sleepScore}%` : '—'}</strong>
              {day.asleep != null ? <span className="small muted">{formatMinutes(day.asleep)} asleep</span> : null}
            </div>
          </div>
        )}

        {note ? (
          <section className="note">
            <h3>Coach note</h3>
            <p className="note-headline">{note.headline}</p>
            <p>{note.why}</p>
            {note.tips.length ? (
              <ul>
                {note.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {s?.recovery?.breakdown && s.recovery.zone ? (
          <section>
            <h3>Why recovery was {s.recovery.score}%</h3>
            <p className="muted small">{RECOVERY_GUIDANCE[s.recovery.zone].title}. A night exactly at your usual would score {s.recovery.breakdown.typical}%.</p>
            <ul className="factors">
              {s.recovery.breakdown.factors.map((f) => (
                <li key={f.key}>
                  <span className={`num ${f.points > 0 ? 'good' : f.points < 0 ? 'bad' : 'neutral'}`}>{formatDelta(f.points)}</span>
                  <div>
                    <strong>{FACTOR_LABELS[f.key]}</strong>
                    <p className="muted small">{recoveryFactorDetail(f)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {s?.sleep ? (
          <section>
            <h3>Sleep</h3>
            <dl className="facts">
              <dt>Asleep</dt>
              <dd>
                {formatMinutes(s.sleep.asleepMinutes)} of {formatMinutes(s.sleep.needMinutes)} needed
              </dd>
              {day?.bedtime != null && day.wake != null ? (
                <>
                  <dt>In bed</dt>
                  <dd>
                    {formatClock(day.bedtime)} – {formatClock(day.wake)}
                  </dd>
                </>
              ) : null}
              {s.sleepNeed ? (
                <>
                  <dt>Need</dt>
                  <dd>
                    {formatMinutes(s.sleepNeed.base)} base
                    {s.sleepNeed.strain ? ` + ${formatMinutes(s.sleepNeed.strain)} after a hard day` : ''}
                    {s.sleepNeed.debt ? ` + ${formatMinutes(s.sleepNeed.debt)} paying back debt` : ''}
                  </dd>
                </>
              ) : null}
              <dt>Score</dt>
              <dd>
                {s.sleep.breakdown.ceiling}% from hours
                {s.sleep.breakdown.penalties.efficiency ? `, −${s.sleep.breakdown.penalties.efficiency} restless` : ''}
                {s.sleep.breakdown.penalties.restorative ? `, −${s.sleep.breakdown.penalties.restorative} little deep/REM` : ''}
                {s.sleep.breakdown.penalties.consistency ? `, −${s.sleep.breakdown.penalties.consistency} off-schedule bedtime` : ''}
                {` = ${s.sleep.score}%`}
              </dd>
              {day?.stages ? (
                <>
                  <dt>Stages</dt>
                  <dd>
                    Deep {formatMinutes(day.stages.deep)}, REM {formatMinutes(day.stages.rem)}, light {formatMinutes(day.stages.light)}, awake {formatMinutes(day.stages.awake)}
                  </dd>
                </>
              ) : null}
            </dl>
          </section>
        ) : null}

        {s ? (
          <section>
            <h3>Strain {s.strain.strain.toFixed(1)}</h3>
            {s.strain.activities.length ? (
              <ul className="list">
                {s.strain.activities.map((a) => (
                  <li key={a.start}>
                    <strong className="num">+{a.strain.toFixed(1)}</strong> {a.workout?.title ?? a.workout?.kind ?? 'Activity'}
                    <span className="muted small">
                      {' '}
                      · {time.format(a.start)}, {Math.round(a.minutes)} min, avg {Math.round(a.avgBpm)} / max {Math.round(a.maxBpm)} bpm
                    </span>
                  </li>
                ))}
                <li>
                  <strong className="num">+{s.strain.everydayStrain.toFixed(1)}</strong> everyday movement
                </li>
              </ul>
            ) : (
              <p className="muted small">No sustained effort detected; all of it was everyday movement.</p>
            )}
          </section>
        ) : null}

        {day && (day.steps != null || day.spo2 != null || day.breathing != null || day.hrv != null) ? (
          <section>
            <h3>Body</h3>
            <dl className="facts">
              {day.hrv != null ? (<><dt>HRV</dt><dd>{day.hrv} ms</dd></>) : null}
              {day.restingHr != null ? (<><dt>Resting HR</dt><dd>{day.restingHr} bpm</dd></>) : null}
              {day.steps != null ? (<><dt>Steps</dt><dd>{formatNumber(day.steps)}</dd></>) : null}
              {day.zoneMinutes != null ? (<><dt>Zone minutes</dt><dd>{day.zoneMinutes}</dd></>) : null}
              {day.spo2 != null ? (<><dt>Blood oxygen</dt><dd>{day.spo2.toFixed(1)}%</dd></>) : null}
              {day.breathing != null ? (<><dt>Breathing</dt><dd>{day.breathing.toFixed(1)} br/min</dd></>) : null}
              {day.skinTemp != null ? (<><dt>Skin temp</dt><dd>{day.skinTemp > 0 ? '+' : ''}{day.skinTemp.toFixed(1)} °C vs usual</dd></>) : null}
              {weight ? (<><dt>Weight</dt><dd>{weight.kg.toFixed(1)} kg</dd></>) : null}
            </dl>
          </section>
        ) : null}

        {workouts.length ? (
          <section>
            <h3>Workouts</h3>
            <ul className="list">
              {workouts.map((w) => (
                <li key={w.id}>
                  <strong className="cap">{w.title ?? w.kind}</strong>
                  <span className="muted small">
                    {' '}
                    · {time.format(w.start)}–{time.format(w.end)}
                    {w.effort != null ? `, effort ${w.effort}/10` : ''}
                    {w.distanceKm ? `, ${w.distanceKm} km` : ''}
                  </span>
                  {w.notes ? <p className="muted small">{w.notes}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {meals.length ? (
          <section>
            <h3>
              Meals <span className="muted small">· {formatNumber(calories)} kcal, {Math.round(protein)} g protein</span>
            </h3>
            <ul className="list">
              {meals.map((m) => (
                <li key={m.id}>
                  {m.description ?? 'Meal'}
                  <span className="muted small">
                    {' '}
                    · {time.format(m.eatenAt)}
                    {m.calories != null ? `, ${m.calories} kcal` : ''}
                    {m.proteinG != null ? `, ${Math.round(m.proteinG)} g protein` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {habits.length ? (
          <section>
            <h3>Habits</h3>
            <ul className="list">
              {habits.map((h, i) => (
                <li key={i} className="cap">
                  {h.kind}
                  {h.amount != null ? ` × ${h.amount}` : ''}
                  {h.note ? <span className="muted small"> · {h.note}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
