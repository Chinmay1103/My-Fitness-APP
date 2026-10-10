import type { ReactNode } from 'react';

export interface TooltipRow {
  color: string;
  label: string;
  value: string;
  /** Key drawn as a short line (lines) or a small square (bars, stacks). */
  shape?: 'line' | 'square';
}

/**
 * The hover readout: the date, then each series' value (value first, label after, as the dataviz
 * guidance says). Positioned inside the chart box at `x`, flipping left near the right edge.
 */
export function Tooltip({ x, width, title, rows, footer }: { x: number; width: number; title: string; rows: TooltipRow[]; footer?: ReactNode }) {
  const flip = x > width - 200;
  return (
    <div className="tooltip" style={flip ? { right: width - x + 12 } : { left: x + 12 }} role="status">
      <div className="tooltip-title">{title}</div>
      {rows.map((r) => (
        <div className="tooltip-row" key={r.label}>
          <span className={r.shape === 'square' ? 'key-square' : 'key-line'} style={{ background: r.color }} />
          <strong>{r.value}</strong>
          <span className="muted">{r.label}</span>
        </div>
      ))}
      {footer ? <div className="tooltip-footer">{footer}</div> : null}
    </div>
  );
}
