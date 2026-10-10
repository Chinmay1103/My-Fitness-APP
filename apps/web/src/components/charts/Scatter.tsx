import { useState, type PointerEvent } from 'react';

import { formatDate } from '../../lib/format';
import type { Fit } from '../../lib/stats';
import { niceDomain, niceTicks } from './scale';
import { Tooltip } from './Tooltip';
import { useWidth } from './useWidth';

const M = { top: 10, right: 16, bottom: 40, left: 52 };

/** One dot per day: x against y, with the best-fit line. Hover finds the nearest dot. */
export function Scatter({
  points,
  fit,
  color,
  xLabel,
  yLabel,
  xFormat,
  yFormat,
  xZero,
  yZero,
  onPick,
  summary,
}: {
  points: { date: string; x: number; y: number }[];
  fit: Fit | null;
  color: string;
  xLabel: string;
  yLabel: string;
  xFormat: (v: number) => string;
  yFormat: (v: number) => string;
  xZero: boolean;
  yZero: boolean;
  onPick?: (date: string) => void;
  summary: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 300;
  const plotW = Math.max(10, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const [x0, x1] = niceDomain(points.map((p) => p.x), xZero);
  const [y0, y1] = niceDomain(points.map((p) => p.y), yZero);
  const sx = (v: number) => M.left + ((v - x0) / (x1 - x0 || 1)) * plotW;
  const sy = (v: number) => M.top + plotH - ((v - y0) / (y1 - y0 || 1)) * plotH;

  const nearest = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - box.left;
    const my = e.clientY - box.top;
    let best: number | null = null;
    let bestD = 24 * 24; // must be within 24 px
    points.forEach((p, i) => {
      const d = (sx(p.x) - mx) ** 2 + (sy(p.y) - my) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };
  const h = hover != null ? points[hover] : undefined;

  return (
    <div className="chart" ref={ref}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={summary}
        onPointerMove={(e) => setHover(nearest(e))}
        onPointerLeave={() => setHover(null)}
        onClick={() => h && onPick?.(h.date)}
        style={{ cursor: h && onPick ? 'pointer' : 'default' }}
      >
        {niceTicks(y0, y1).map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} x2={M.left + plotW} y1={sy(t)} y2={sy(t)} className="grid" />
            <text x={M.left - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="axis">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {niceTicks(x0, x1, 5).map((t) => (
          <text key={`x${t}`} x={sx(t)} y={M.top + plotH + 16} textAnchor="middle" className="axis">
            {xFormat(t)}
          </text>
        ))}
        <text x={M.left + plotW / 2} y={height - 4} textAnchor="middle" className="axis-title">
          {xLabel}
        </text>
        <text transform={`translate(12 ${M.top + plotH / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">
          {yLabel}
        </text>
        {points.map((p, i) => (
          <circle key={p.date} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={color} opacity={hover == null || hover === i ? 0.75 : 0.35} className="ring" />
        ))}
        {fit ? (
          <line
            x1={sx(x0)}
            x2={sx(x1)}
            y1={sy(fit.intercept + fit.slope * x0)}
            y2={sy(fit.intercept + fit.slope * x1)}
            stroke="var(--text)"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.7}
          />
        ) : null}
        {h ? <circle cx={sx(h.x)} cy={sy(h.y)} r={6} fill={color} className="ring" /> : null}
      </svg>
      {h ? (
        <Tooltip
          x={sx(h.x)}
          width={width}
          title={formatDate(h.date)}
          rows={[
            { color, label: xLabel, value: xFormat(h.x), shape: 'square' },
            { color, label: yLabel, value: yFormat(h.y), shape: 'square' },
          ]}
          footer={onPick ? 'Click to open the day' : undefined}
        />
      ) : null}
    </div>
  );
}
