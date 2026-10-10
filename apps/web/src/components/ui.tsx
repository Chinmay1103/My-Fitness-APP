import type { ReactNode } from 'react';

import { formatDelta } from '../lib/format';
import type { MetricDef } from '../lib/metrics';

export function Card({ title, subtitle, action, children, className }: { title?: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ''}`}>
      {title ? (
        <header className="card-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="muted small">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** A number with its change against the previous period, colored by whether the change is good. */
export function StatTile({ def, value, previous, onClick, note, vs = 'previous period' }: { def: MetricDef; value: number | null; previous: number | null; onClick?: () => void; note?: string; vs?: string }) {
  const delta = value != null && previous != null ? value - previous : null;
  const decimals = def.key === 'strain' || def.key === 'asleep' ? 1 : 0;
  const tone =
    delta == null || def.better == null || Math.abs(delta) < 10 ** -decimals / 2
      ? 'neutral'
      : (delta > 0) === (def.better === 'up')
        ? 'good'
        : 'bad';
  const deltaText =
    delta == null ? null : def.key === 'asleep' ? `${formatDelta(delta * 60)} min` : def.key === 'bedtime' ? `${formatDelta(delta)} min` : formatDelta(delta, decimals);
  return (
    <button type="button" className="stat" onClick={onClick} disabled={!onClick}>
      <span className="stat-label">
        <span className="key-square" style={{ background: def.color }} />
        {def.label}
      </span>
      <span className="stat-value num">{value == null ? '—' : def.format(value)}</span>
      <span className={`stat-delta ${tone}`}>
        {deltaText ? `${deltaText} vs ${vs}` : note ?? 'no earlier data to compare'}
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/** A link-styled button that opens a day. */
export function DayLink({ date, onPick, children }: { date: string; onPick: (d: string) => void; children: ReactNode }) {
  return (
    <button type="button" className="link" onClick={() => onPick(date)}>
      {children}
    </button>
  );
}
