/**
 * Hand-rolled SVG charts.
 *
 * A charting library would be several hundred kilobytes for two chart types,
 * and this app is meant to be small enough to load instantly on a phone at a
 * service station. These scale with their container, work in both themes and
 * carry text alternatives for screen readers.
 */

import { useId, useMemo, useState } from 'react';
import { money } from '../lib/format';
import type { CostLine } from '../model/types';

export const GROUP_ORDER: CostLine['group'][] = ['energy', 'tax', 'fixed', 'capital', 'reimbursement'];

export const GROUP_LABELS: Record<CostLine['group'], string> = {
  energy: 'Energy',
  tax: 'Tax',
  fixed: 'Standing costs',
  capital: 'Cost of the car',
  reimbursement: 'Mileage claimed back',
};

export const GROUP_COLOURS: Record<CostLine['group'], string> = {
  energy: '#2f6fed',
  tax: '#e2683a',
  fixed: '#0f9d76',
  capital: '#8a5cf6',
  reimbursement: '#6b7280',
};

export interface StackedBarDatum {
  id: string;
  label: string;
  groups: Record<CostLine['group'], number>;
  total: number;
}

export function StackedBarChart({ data, unitLabel }: { data: StackedBarDatum[]; unitLabel: string }) {
  const titleId = useId();
  const max = Math.max(1, ...data.map((d) => GROUP_ORDER.reduce((sum, g) => sum + Math.max(0, d.groups[g]), 0)));
  const barHeight = 34;
  const gap = 18;
  const labelWidth = 150;
  const chartWidth = 560;
  const height = data.length * (barHeight + gap) + 8;

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${labelWidth + chartWidth + 90} ${height}`}
        role="img"
        aria-labelledby={titleId}
        className="chart-svg"
      >
        <title id={titleId}>
          {`Cost breakdown ${unitLabel}. ` +
            data.map((d) => `${d.label}: ${money(d.total)}`).join('. ')}
        </title>
        {data.map((d, i) => {
          const y = i * (barHeight + gap);
          let x = labelWidth;
          return (
            <g key={d.id}>
              <text x={labelWidth - 12} y={y + barHeight / 2 + 5} textAnchor="end" className="chart-label">
                {d.label.length > 20 ? `${d.label.slice(0, 19)}…` : d.label}
              </text>
              {GROUP_ORDER.map((group) => {
                const value = d.groups[group];
                if (!value || value <= 0) return null;
                const w = (value / max) * chartWidth;
                const rect = (
                  <rect
                    key={group}
                    x={x}
                    y={y}
                    width={Math.max(0, w)}
                    height={barHeight}
                    fill={GROUP_COLOURS[group]}
                    className="chart-bar"
                  >
                    <title>{`${GROUP_LABELS[group]}: ${money(value)}`}</title>
                  </rect>
                );
                x += w;
                return rect;
              })}
              {/* Money claimed back is drawn as a notch pointing the other way. */}
              {d.groups.reimbursement < 0 ? (
                <rect
                  x={x + (d.groups.reimbursement / max) * chartWidth}
                  y={y + barHeight / 4}
                  width={Math.abs((d.groups.reimbursement / max) * chartWidth)}
                  height={barHeight / 2}
                  fill="none"
                  stroke={GROUP_COLOURS.reimbursement}
                  strokeDasharray="4 3"
                  strokeWidth={2}
                >
                  <title>{`Claimed back: ${money(d.groups.reimbursement)}`}</title>
                </rect>
              ) : null}
              <text x={x + 10} y={y + barHeight / 2 + 5} className="chart-value">
                {money(d.total)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="chart-legend">
        {GROUP_ORDER.filter((g) => data.some((d) => d.groups[g])).map((g) => (
          <span key={g} className="legend-item">
            <span className="legend-swatch" style={{ background: GROUP_COLOURS[g] }} aria-hidden="true" />
            {GROUP_LABELS[g]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export interface LineSeries {
  id: string;
  label: string;
  colour: string;
  points: { x: number; y: number }[];
}

export function LineChart({
  series,
  xLabel,
  yLabel,
  formatX,
  crossings,
}: {
  series: LineSeries[];
  xLabel: string;
  yLabel: string;
  formatX: (v: number) => string;
  crossings?: { x: number; label: string }[];
}) {
  const titleId = useId();
  const [hoverX, setHoverX] = useState<number | null>(null);

  const bounds = useMemo(() => {
    const xs = series.flatMap((s) => s.points.map((p) => p.x));
    const ys = series.flatMap((s) => s.points.map((p) => p.y));
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(0, ...ys);
    const maxY = Math.max(...ys);
    // Breathing room at the top so the highest line isn't pinned to the edge.
    return { minX, maxX, minY, maxY: maxY + (maxY - minY) * 0.08 };
  }, [series]);

  const width = 640;
  const height = 300;
  const padding = { top: 16, right: 20, bottom: 44, left: 66 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const sx = (x: number) =>
    padding.left + ((x - bounds.minX) / Math.max(1e-9, bounds.maxX - bounds.minX)) * plotW;
  const sy = (y: number) =>
    padding.top + plotH - ((y - bounds.minY) / Math.max(1e-9, bounds.maxY - bounds.minY)) * plotH;

  const yTicks = niceTicks(bounds.minY, bounds.maxY, 5);
  const xTicks = niceTicks(bounds.minX, bounds.maxX, 5);

  const hovered = hoverX === null ? null : nearestIndex(series[0]?.points ?? [], hoverX);

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={titleId}
        className="chart-svg"
        onMouseLeave={() => setHoverX(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const svgX = ratio * width;
          const value =
            bounds.minX + ((svgX - padding.left) / plotW) * (bounds.maxX - bounds.minX);
          setHoverX(value);
        }}
      >
        <title id={titleId}>
          {`${yLabel} against ${xLabel}. ` +
            series
              .map(
                (s) =>
                  `${s.label}: ${money(s.points[0]?.y ?? 0)} at ${formatX(bounds.minX)} rising to ${money(
                    s.points[s.points.length - 1]?.y ?? 0,
                  )} at ${formatX(bounds.maxX)}`,
              )
              .join('. ')}
        </title>

        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={padding.left} x2={width - padding.right} y1={sy(t)} y2={sy(t)} className="chart-grid" />
            <text x={padding.left - 8} y={sy(t) + 4} textAnchor="end" className="chart-tick">
              {money(t)}
            </text>
          </g>
        ))}

        {xTicks.map((t) => (
          <text key={`x${t}`} x={sx(t)} y={height - padding.bottom + 20} textAnchor="middle" className="chart-tick">
            {formatX(t)}
          </text>
        ))}

        {crossings?.map((c) => (
          <g key={c.label}>
            <line x1={sx(c.x)} x2={sx(c.x)} y1={padding.top} y2={padding.top + plotH} className="chart-crossing" />
            <text x={sx(c.x)} y={padding.top + 12} textAnchor="middle" className="chart-crossing-label">
              {c.label}
            </text>
          </g>
        ))}

        {series.map((s) => (
          <path
            key={s.id}
            d={s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x)},${sy(p.y)}`).join(' ')}
            fill="none"
            stroke={s.colour}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        ))}

        {hovered !== null && series[0]?.points[hovered] ? (
          <g>
            <line
              x1={sx(series[0].points[hovered].x)}
              x2={sx(series[0].points[hovered].x)}
              y1={padding.top}
              y2={padding.top + plotH}
              className="chart-hover-line"
            />
            {series.map((s) => {
              const p = s.points[hovered];
              if (!p) return null;
              return <circle key={s.id} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={s.colour} />;
            })}
          </g>
        ) : null}

        <text x={padding.left + plotW / 2} y={height - 6} textAnchor="middle" className="chart-axis-label">
          {xLabel}
        </text>
      </svg>

      <figcaption className="chart-legend">
        {series.map((s) => (
          <span key={s.id} className="legend-item">
            <span className="legend-swatch" style={{ background: s.colour }} aria-hidden="true" />
            {s.label}
            {hovered !== null && s.points[hovered] ? (
              <strong className="legend-value">{money(s.points[hovered].y)}</strong>
            ) : null}
          </span>
        ))}
        {hovered !== null && series[0]?.points[hovered] ? (
          <span className="legend-x">at {formatX(series[0].points[hovered].x)}</span>
        ) : null}
      </figcaption>
    </figure>
  );
}

function nearestIndex(points: { x: number }[], x: number): number | null {
  if (points.length === 0) return null;
  let best = 0;
  let bestDistance = Infinity;
  points.forEach((p, i) => {
    const d = Math.abs(p.x - x);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return best;
}

/** Round tick values to something a human would choose. */
function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min];
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalised = raw / magnitude;
  const step = (normalised >= 5 ? 5 : normalised >= 2 ? 2 : 1) * magnitude;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + 1e-9; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return ticks;
}

/** Simple proportional bar used inside the charging mix editor. */
export function MixBar({ segments }: { segments: { id: string; pct: number; colour: string; label: string }[] }) {
  return (
    <div className="mix-bar" role="img" aria-label={segments.map((s) => `${s.label} ${s.pct.toFixed(0)}%`).join(', ')}>
      {segments
        .filter((s) => s.pct > 0.01)
        .map((s) => (
          <span
            key={s.id}
            className="mix-bar-seg"
            style={{ width: `${s.pct}%`, background: s.colour }}
            title={`${s.label}: ${s.pct.toFixed(1)}%`}
          />
        ))}
    </div>
  );
}
