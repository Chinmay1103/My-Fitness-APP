import { useState } from 'react';

import { addDays, weekday, weekStart } from '../../lib/dates';
import { formatDate, formatMonthShort } from '../../lib/format';
import { Tooltip } from './Tooltip';
import { useWidth } from './useWidth';

/**
 * A year-at-a-glance grid: one column per week (Monday on top), one cell per day, colored by
 * `color(date)`. Hover shows the day; click opens it.
 */
export function Calendar({
  from,
  to,
  color,
  describe,
  onPick,
  summary,
}: {
  from: string;
  to: string;
  color: (date: string) => string | null;
  describe: (date: string) => { label: string; value: string; color: string } | null;
  onPick?: (date: string) => void;
  summary: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const first = weekStart(from);
  const weeks: string[][] = [];
  for (let w = first; w <= to; w = addDays(w, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)));
  const left = 28;
  const top = 18;
  const gap = 2;
  const cell = Math.max(6, Math.min(16, Math.floor((width - left) / Math.max(1, weeks.length)) - gap));
  const pitch = cell + gap;
  const height = top + 7 * pitch;
  const info = hover ? describe(hover) : null;
  const hx = hover ? left + Math.floor((Date.parse(hover) - Date.parse(first)) / (7 * 86_400_000)) * pitch + cell / 2 : 0;

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={summary} onPointerLeave={() => setHover(null)}>
        {['Mon', 'Wed', 'Fri'].map((d, i) => (
          <text key={d} x={0} y={top + i * 2 * pitch + cell / 2} dy="0.32em" className="axis">
            {d}
          </text>
        ))}
        {weeks.map((week, wi) => {
          const firstOfMonth = week.find((d) => d.endsWith('-01') && d >= from && d <= to);
          return (
            <g key={week[0]}>
              {firstOfMonth && wi < weeks.length - 1 ? (
                <text x={left + wi * pitch} y={10} className="axis">
                  {firstOfMonth.slice(5, 7) === '01' ? firstOfMonth.slice(0, 4) : formatMonthShort(firstOfMonth)}
                </text>
              ) : null}
              {week.map((d) => {
                if (d < from || d > to) return null;
                const fill = color(d);
                return (
                  <rect
                    key={d}
                    x={left + wi * pitch}
                    y={top + weekday(d) * pitch}
                    width={cell}
                    height={cell}
                    rx={2}
                    fill={fill ?? 'var(--track)'}
                    className={hover === d ? 'cell cell-hover' : 'cell'}
                    onPointerEnter={() => setHover(d)}
                    onClick={() => onPick?.(d)}
                    style={{ cursor: onPick ? 'pointer' : 'default' }}
                  >
                    <title>{formatDate(d)}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}
      </svg>
      {hover ? (
        <Tooltip
          x={hx}
          width={width}
          title={formatDate(hover)}
          rows={info ? [{ ...info, shape: 'square' }] : [{ color: 'transparent', label: 'no data this day', value: '—' }]}
          footer={onPick ? 'Click to open the day' : undefined}
        />
      ) : null}
    </div>
  );
}
