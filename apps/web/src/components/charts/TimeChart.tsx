import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';

import { formatDate } from '../../lib/format';
import { clockDomain, dateTicks, niceDomain, niceTicks } from './scale';
import { Tooltip, type TooltipRow } from './Tooltip';
import { useWidth } from './useWidth';

/**
 * One chart for everything day-by-day: lines, bars, stacked bars, time ranges and need ticks, all
 * on one shared date axis and one y axis (never two). Hover or arrow keys show a readout of every
 * series at that day; click or Enter opens the day.
 */

export interface LineSeries {
  kind: 'line';
  label: string;
  color: string;
  values: (number | null)[];
  format: (v: number) => string;
  /** Daily values drawn faint behind an average. */
  faint?: boolean;
  /** Draw across missing days (for things logged now and then, like weight). */
  connectGaps?: boolean;
  /** A dot on every value (e.g. each gym session). */
  dots?: boolean;
}

export interface BarSeries {
  kind: 'bars';
  label: string;
  color: string;
  values: (number | null)[];
  format: (v: number) => string;
  /** Per-bar color, e.g. the recovery zone. */
  colors?: (string | null)[];
  /** What a per-bar color means, for the readout ("Green"). */
  colorLabels?: (string | null)[];
}

export interface StackSeries {
  kind: 'stack';
  parts: { label: string; color: string; values: (number | null)[] }[];
  format: (v: number) => string;
}

export interface RangeSeries {
  kind: 'range';
  label: string;
  color: string;
  values: ([number, number] | null)[];
  format: (v: [number, number]) => string;
}

/** A short horizontal mark per day, e.g. how much sleep was needed. */
export interface TickSeries {
  kind: 'ticks';
  label: string;
  color: string;
  values: (number | null)[];
  format: (v: number) => string;
}

export type Series = LineSeries | BarSeries | StackSeries | RangeSeries | TickSeries;

interface Props {
  dates: string[];
  series: Series[];
  height?: number;
  zeroBased?: boolean;
  domain?: [number, number];
  yFormat?: (v: number) => string;
  /** Flip the axis (for time of day: earlier at the top). */
  invert?: boolean;
  /** Values are minutes after midnight: ticks on the hour. */
  clock?: boolean;
  /** A shaded "your normal" band. */
  band?: { low: number; high: number };
  onPick?: (date: string) => void;
  /** Spoken summary for screen readers. */
  summary: string;
}

const M = { top: 10, right: 12, bottom: 26, left: 48 };

function linePath(xs: number[], ys: (number | null)[], connect: boolean): string {
  let d = '';
  let pen = false;
  ys.forEach((y, i) => {
    if (y == null) {
      if (!connect) pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${xs[i]!.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  });
  return d;
}

export function TimeChart({ dates, series, height = 220, zeroBased = true, domain, yFormat, invert, clock, band, onPick, summary }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = dates.length;
  const plotW = Math.max(10, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const step = plotW / Math.max(1, n);
  const xs = useMemo(() => dates.map((_, i) => M.left + step * (i + 0.5)), [dates, step]);

  const [lo, hi, clockTicks] = useMemo((): [number, number, number[] | null] => {
    const all: number[] = [];
    for (const s of series) {
      if (s.kind === 'stack') {
        for (let i = 0; i < n; i++) all.push(s.parts.reduce((a, p) => a + (p.values[i] ?? 0), 0));
      } else if (s.kind === 'range') {
        for (const v of s.values) if (v) all.push(v[0], v[1]);
      } else {
        for (const v of s.values) if (v != null) all.push(v);
      }
    }
    if (band) all.push(band.low, band.high);
    if (clock) {
      const c = clockDomain(all);
      return [c.domain[0], c.domain[1], c.ticks];
    }
    return [...niceDomain(all, zeroBased, domain), null];
  }, [series, n, zeroBased, domain, band, clock]);

  const y = (v: number) => {
    const t = (v - lo) / (hi - lo || 1);
    return invert ? M.top + t * plotH : M.top + plotH - t * plotH;
  };
  const base = invert ? M.top : M.top + plotH;
  const barW = Math.max(1, Math.min(24, step >= 4 ? step - 2 : step));
  const ticks = clockTicks ?? niceTicks(lo, hi);
  // Drop labels that would run into the one before (a few sessions on a phone-width chart).
  let lastX = -Infinity;
  const xTicks = dateTicks(dates).filter((t) => {
    const x = M.left + step * (t.index + 0.5);
    if (x - lastX < 52) return false;
    lastX = x;
    return true;
  });
  const fmtY = yFormat ?? ((v: number) => String(v));
  const radius = Math.min(4, barW / 2);

  /** A bar from the baseline to `v`, square at the base and rounded at the data end. */
  const bar = (x: number, from: number, to: number, roundEnd: boolean) => {
    const top = Math.min(from, to);
    const h = Math.abs(to - from);
    if (h < 0.5) return '';
    const r = roundEnd ? Math.min(radius, h) : 0;
    const l = x - barW / 2;
    const rt = l + barW;
    // Data end is at the top unless the axis is inverted.
    if (!invert) {
      return `M${l},${top + h}V${top + r}Q${l},${top} ${l + r},${top}H${rt - r}Q${rt},${top} ${rt},${top + r}V${top + h}Z`;
    }
    return `M${l},${top}V${top + h - r}Q${l},${top + h} ${l + r},${top + h}H${rt - r}Q${rt},${top + h} ${rt},${top + h - r}V${top}Z`;
  };

  const pick = (i: number | null) => {
    if (i != null && onPick && dates[i]) onPick(dates[i]!);
  };

  const indexAt = (e: MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - box.left - M.left) / step);
    return i >= 0 && i < n ? i : null;
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setHover((h) => Math.min(n - 1, Math.max(0, (h ?? n) + (e.key === 'ArrowRight' ? 1 : -1))));
    } else if (e.key === 'Enter') pick(hover);
    else if (e.key === 'Escape') setHover(null);
  };

  const rows: TooltipRow[] = [];
  if (hover != null) {
    for (const s of series) {
      if (s.kind === 'stack') {
        for (const p of [...s.parts].reverse()) {
          const v = p.values[hover];
          if (v != null) rows.push({ color: p.color, label: p.label, value: s.format(v), shape: 'square' });
        }
      } else if (s.kind === 'range') {
        const v = s.values[hover];
        if (v) rows.push({ color: s.color, label: s.label, value: s.format(v), shape: 'square' });
      } else {
        const v = s.values[hover];
        if (v == null) continue;
        const label = s.kind === 'bars' && s.colorLabels?.[hover] ? `${s.label} · ${s.colorLabels[hover]}` : s.label;
        const color = s.kind === 'bars' ? (s.colors?.[hover] ?? s.color) : s.color;
        rows.push({ color, label, value: s.format(v), shape: s.kind === 'bars' ? 'square' : 'line' });
      }
    }
  }

  return (
    <div className="chart" ref={ref}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={summary}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerMove={(e) => setHover(indexAt(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => pick(indexAt(e))}
        onMouseDown={(e) => e.preventDefault()}
        onBlur={() => setHover(null)}
        style={{ cursor: onPick ? 'pointer' : 'default' }}
      >
        {band ? (
          <rect x={M.left} width={plotW} y={Math.min(y(band.low), y(band.high))} height={Math.abs(y(band.high) - y(band.low))} className="band" />
        ) : null}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} className="grid" />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="axis">
              {fmtY(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t.index} x={xs[t.index]} y={height - 6} textAnchor="middle" className="axis">
            {t.label}
          </text>
        ))}
        {hover != null ? <rect x={xs[hover]! - step / 2} width={step} y={M.top} height={plotH} className="hover-col" /> : null}
        {series.map((s, si) => {
          if (s.kind === 'bars') {
            return (
              <g key={si}>
                {s.values.map((v, i) =>
                  v == null ? null : (
                    <path key={i} d={bar(xs[i]!, base, y(v), true)} fill={s.colors?.[i] ?? s.color} opacity={hover == null || hover === i ? 1 : 0.55} />
                  ),
                )}
              </g>
            );
          }
          if (s.kind === 'stack') {
            return (
              <g key={si}>
                {dates.map((_, i) => {
                  let acc = 0;
                  const present = s.parts.filter((p) => (p.values[i] ?? 0) > 0);
                  return present.map((p, pi) => {
                    const v = p.values[i]!;
                    const from = y(acc);
                    acc += v;
                    // 2px surface gap between segments, when bars are wide enough to show it.
                    const gap = barW >= 4 && pi > 0 ? (invert ? 2 : -2) : 0;
                    return (
                      <path
                        key={`${i}-${p.label}`}
                        d={bar(xs[i]!, from + gap, y(acc), pi === present.length - 1)}
                        fill={p.color}
                        opacity={hover == null || hover === i ? 1 : 0.55}
                      />
                    );
                  });
                })}
              </g>
            );
          }
          if (s.kind === 'range') {
            return (
              <g key={si}>
                {s.values.map((v, i) => {
                  if (!v) return null;
                  const top = Math.min(y(v[0]), y(v[1]));
                  const h = Math.max(2, Math.abs(y(v[1]) - y(v[0])));
                  return (
                    <rect key={i} x={xs[i]! - barW / 2} width={barW} y={top} height={h} rx={Math.min(radius, barW / 2)} fill={s.color} opacity={hover == null || hover === i ? 1 : 0.55} />
                  );
                })}
              </g>
            );
          }
          if (s.kind === 'ticks') {
            const half = Math.max(barW / 2 + 2, 3);
            return (
              <g key={si}>
                {s.values.map((v, i) => (v == null ? null : <line key={i} x1={xs[i]! - half} x2={xs[i]! + half} y1={y(v)} y2={y(v)} stroke={s.color} strokeWidth={2} strokeLinecap="round" />))}
              </g>
            );
          }
          const ys = s.values.map((v) => (v == null ? null : y(v)));
          // A lone point between gaps has no line to sit on: give it a dot.
          // Measurements taken now and then (faint, gaps connected) get a dot on each one; averages don't.
          const lone = s.connectGaps
            ? s.values.map((v) => v != null && (!!s.faint || !!s.dots))
            : s.values.map((v, i) => v != null && s.values[i - 1] == null && s.values[i + 1] == null);
          return (
            <g key={si} opacity={s.faint ? 0.35 : 1}>
              <path d={linePath(xs, ys, !!s.connectGaps)} fill="none" stroke={s.color} strokeWidth={s.faint ? 1.5 : 2} strokeLinejoin="round" strokeLinecap="round" />
              {ys.map((yy, i) => (yy != null && lone[i] && (s.connectGaps && !s.dots ? n <= 120 : true) ? <circle key={i} cx={xs[i]} cy={yy} r={s.faint && !s.connectGaps ? 2 : 3} fill={s.color} /> : null))}
            </g>
          );
        })}
        {hover != null ? (
          <>
            <line x1={xs[hover]} x2={xs[hover]} y1={M.top} y2={M.top + plotH} className="crosshair" />
            {series.map((s, si) => {
              if (s.kind !== 'line') return null;
              const v = s.values[hover];
              return v == null ? null : <circle key={si} cx={xs[hover]} cy={y(v)} r={4} fill={s.color} className="ring" />;
            })}
          </>
        ) : null}
      </svg>
      {hover != null && dates[hover] ? (
        <Tooltip
          x={xs[hover]!}
          width={width}
          title={formatDate(dates[hover]!)}
          rows={rows.length ? rows : [{ color: 'transparent', label: 'no data this day', value: '—' }]}
          footer={onPick ? 'Click to open the day' : undefined}
        />
      ) : null}
    </div>
  );
}

/** Legend for two or more series: a line key for lines, a square for bars. */
export function Legend({ items }: { items: { label: string; color: string; shape?: 'line' | 'square' }[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label} className="legend-item">
          <span className={it.shape === 'line' ? 'key-line' : 'key-square'} style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
