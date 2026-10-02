// Charts for the artist Analytics page.
//
// Built to the data-viz method: one validated accent (teal-600, passes the
// lightness/chroma/contrast checks on white), thin marks (bars ≤ 24px with a 4px
// rounded data-end, 2px lines), solid hairline grid, clean y-ticks, sparse
// x-labels, hover + keyboard tooltips, and a table view for every chart.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';

export const VIZ = {
  accent: '#0d9488',         // teal-600 — the one data hue
  accentWash: 'rgba(13,148,136,0.10)',
  deEmphasis: '#d6d3d1',     // stone-300 — context marks
  grid: '#e7e5e4',           // stone-200 — hairline grid
  surface: '#ffffff',
  textPrimary: '#0b0b0b',
  textSecondary: '#57534e',
  textMuted: '#78716c',
};

export interface DayPoint { date: string; value: number }

const fmtCompact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    : n >= 10_000 ? `${Math.round(n / 1000)}K`
      : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
        : n.toLocaleString();

export const fmtNumber = (n: number) => n.toLocaleString();
export { fmtCompact };

const fmtDay = (iso: string, pattern = 'MMM d') => {
  try { return format(parseISO(iso), pattern); } catch { return iso; }
};

/** Clean axis: 0 … niceMax in 3–5 round steps. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/** Width of an element, kept in sync on resize. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Column path: 4px rounded data-end, square at the baseline. */
function columnPath(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

const PAD = { top: 12, right: 12, bottom: 26, left: 40 };

function Tooltip({ x, y, title, value, unit, containerWidth }: {
  x: number; y: number; title: string; value: number; unit: string; containerWidth: number;
}) {
  const left = Math.min(Math.max(x, 70), containerWidth - 70);
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border-2 border-black bg-white px-3 py-2 shadow-[3px_3px_0_0_#000]"
      style={{ left, top: Math.max(y - 10, 0) }}
    >
      <p className="text-base font-bold leading-tight tabular-nums" style={{ color: VIZ.textPrimary }}>
        {fmtNumber(value)} <span className="text-xs font-semibold" style={{ color: VIZ.textSecondary }}>{unit}</span>
      </p>
      <p className="text-[11px] whitespace-nowrap" style={{ color: VIZ.textSecondary }}>{title}</p>
    </div>
  );
}

function YAxis({ ticks, toY, width }: { ticks: number[]; toY: (v: number) => number; width: number }) {
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={width - PAD.right} y1={toY(t)} y2={toY(t)} stroke={VIZ.grid} strokeWidth={1} />
          <text x={PAD.left - 8} y={toY(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={VIZ.textMuted}
            style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmtCompact(t)}
          </text>
        </g>
      ))}
    </>
  );
}

function XLabels({ data, toX, height, width }: { data: DayPoint[]; toX: (i: number) => number; height: number; width: number }) {
  // ~64px per label so dates never collide, whatever the card width.
  const fit = Math.max(2, Math.floor((width - PAD.left - PAD.right) / 64));
  const every = Math.max(1, Math.ceil(data.length / fit));
  return (
    <>
      {data.map((d, i) => (i % every === 0 || i === data.length - 1) && (i === data.length - 1 || data.length - 1 - i >= every / 2) ? (
        <text key={d.date} x={toX(i)} y={height - 6} textAnchor={i === data.length - 1 && i > 0 ? "end" : i === 0 ? "start" : "middle"} fontSize={11} fill={VIZ.textMuted}>
          {fmtDay(d.date)}
        </text>
      ) : null)}
    </>
  );
}

// ─── Column chart (daily plays) ──────────────────────────────────────────────
export const ColumnChart: React.FC<{ data: DayPoint[]; unit: string; height?: number; ariaLabel: string }> = ({
  data, unit, height = 220, ariaLabel,
}) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = useMemo(() => niceTicks(max), [max]);
  const top = ticks[ticks.length - 1] || 1;
  const iW = Math.max(0, width - PAD.left - PAD.right);
  const iH = height - PAD.top - PAD.bottom;
  const slot = data.length ? iW / data.length : 0;
  const barW = Math.max(2, Math.min(24, slot - 2));
  const toX = (i: number) => PAD.left + slot * i + slot / 2;
  const toY = (v: number) => PAD.top + iH - (v / top) * iH;

  return (
    <div ref={ref} className="relative w-full" onPointerLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <YAxis ticks={ticks} toY={toY} width={width} />
          {data.map((d, i) => {
            const h = (d.value / top) * iH;
            const isActive = active === i;
            return (
              <g key={d.date}>
                <path
                  d={columnPath(toX(i) - barW / 2, PAD.top + iH - h, barW, h)}
                  fill={VIZ.accent}
                  opacity={active === null || isActive ? 1 : 0.45}
                />
                {/* Hit area: the whole slot, focusable for keyboard users. */}
                <rect
                  x={PAD.left + slot * i} y={PAD.top} width={slot} height={iH}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${fmtDay(d.date, 'EEEE, MMM d')}: ${fmtNumber(d.value)} ${unit}`}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  style={{ outline: 'none', cursor: 'default' }}
                />
              </g>
            );
          })}
          <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + iH} y2={PAD.top + iH} stroke={VIZ.textMuted} strokeWidth={1} />
          <XLabels data={data} toX={toX} height={height} width={width} />
        </svg>
      )}
      {active !== null && data[active] && (
        <Tooltip
          x={toX(active)} y={toY(data[active].value)}
          title={fmtDay(data[active].date, 'EEE, MMM d')}
          value={data[active].value} unit={unit} containerWidth={width}
        />
      )}
    </div>
  );
};

// ─── Line chart (daily listeners) ────────────────────────────────────────────
export const LineChart: React.FC<{ data: DayPoint[]; unit: string; height?: number; ariaLabel: string }> = ({
  data, unit, height = 220, ariaLabel,
}) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = useMemo(() => niceTicks(max), [max]);
  const top = ticks[ticks.length - 1] || 1;
  const iW = Math.max(0, width - PAD.left - PAD.right);
  const iH = height - PAD.top - PAD.bottom;
  const toX = (i: number) => PAD.left + (data.length <= 1 ? iW / 2 : (iW * i) / (data.length - 1));
  const toY = (v: number) => PAD.top + iH - (v / top) * iH;

  const line = data.map((d, i) => `${i ? 'L' : 'M'}${toX(i)},${toY(d.value)}`).join(' ');
  const area = data.length ? `${line} L${toX(data.length - 1)},${PAD.top + iH} L${toX(0)},${PAD.top + iH} Z` : '';
  const last = data.length - 1;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = data.length <= 1 ? 0 : Math.round((x / rect.width) * (data.length - 1));
    setActive(Math.max(0, Math.min(last, i)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') setActive((a) => Math.min(last, (a ?? -1) + 1));
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? last + 1) - 1));
  };

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <YAxis ticks={ticks} toY={toY} width={width} />
          <path d={area} fill={VIZ.accentWash} />
          <path d={line} fill="none" stroke={VIZ.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {active !== null && (
            <line x1={toX(active)} x2={toX(active)} y1={PAD.top} y2={PAD.top + iH} stroke={VIZ.textMuted} strokeWidth={1} />
          )}
          {/* End marker + direct label on the latest value */}
          {last >= 0 && (
            <>
              <circle cx={toX(active ?? last)} cy={toY(data[active ?? last].value)} r={5} fill={VIZ.accent} stroke={VIZ.surface} strokeWidth={2} />
            </>
          )}
          <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + iH} y2={PAD.top + iH} stroke={VIZ.textMuted} strokeWidth={1} />
          <XLabels data={data} toX={toX} height={height} width={width} />
          {/* Crosshair hit layer */}
          <rect
            x={PAD.left} y={PAD.top} width={iW} height={iH} fill="transparent"
            tabIndex={0}
            aria-label={`${ariaLabel}. Use left and right arrow keys to read each day.`}
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(last)}
            onBlur={() => setActive(null)}
            onKeyDown={onKey}
            style={{ outline: 'none' }}
          />
        </svg>
      )}
      {active !== null && data[active] && (
        <Tooltip
          x={toX(active)} y={toY(data[active].value)}
          title={fmtDay(data[active].date, 'EEE, MMM d')}
          value={data[active].value} unit={unit} containerWidth={width}
        />
      )}
    </div>
  );
};

// ─── Sparkline (stat tiles) ──────────────────────────────────────────────────
export const Sparkline: React.FC<{ values: number[]; width?: number; height?: number }> = ({ values, width = 96, height = 28 }) => {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 3 - (v / max) * (height - 6)}`);
  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={VIZ.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

// ─── Ranked bars (top tracks) ────────────────────────────────────────────────
export const RankedBars: React.FC<{ rows: { id: string; label: string; sub?: string; value: number }[]; unit: string }> = ({ rows, unit }) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => {
        const pct = Math.max(r.value > 0 ? 1.5 : 0, (r.value / max) * 100);
        return (
          // Phone: label + value on one line, bar full-width below. sm+: one row.
          <li key={r.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] sm:grid-cols-[1.5rem_minmax(0,14rem)_1fr_auto] items-center gap-x-3 gap-y-1.5">
            <span className="text-xs tabular-nums text-right" style={{ color: VIZ.textMuted }}>{i + 1}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold truncate" style={{ color: VIZ.textPrimary }}>{r.label}</span>
              {r.sub && <span className="block text-xs truncate" style={{ color: VIZ.textMuted }}>{r.sub}</span>}
            </span>
            <span className="col-start-2 col-span-2 row-start-2 sm:col-start-3 sm:col-span-1 sm:row-start-1 h-3 sm:h-4 relative" aria-hidden="true">
              <span className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${pct}%`, background: VIZ.accent }} />
            </span>
            <span className="col-start-3 row-start-1 sm:col-start-4 text-sm font-semibold tabular-nums text-right min-w-[3.5rem]" style={{ color: VIZ.textPrimary }}>
              {fmtNumber(r.value)} <span className="sr-only">{unit}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
};

// ─── Table view for a daily series ───────────────────────────────────────────
export const DataTable: React.FC<{ data: DayPoint[]; valueLabel: string }> = ({ data, valueLabel }) => (
  <details className="mt-3 group">
    <summary className="cursor-pointer text-xs font-semibold select-none" style={{ color: VIZ.textSecondary }}>
      Show data
    </summary>
    <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border" style={{ borderColor: VIZ.grid }}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr style={{ color: VIZ.textMuted }}>
            <th className="text-left font-semibold px-3 py-1.5 text-xs">Date</th>
            <th className="text-right font-semibold px-3 py-1.5 text-xs">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {[...data].reverse().map((d) => (
            <tr key={d.date} className="border-t" style={{ borderColor: VIZ.grid }}>
              <td className="px-3 py-1" style={{ color: VIZ.textSecondary }}>{fmtDay(d.date, 'EEE, MMM d')}</td>
              <td className="px-3 py-1 text-right tabular-nums" style={{ color: VIZ.textPrimary }}>{fmtNumber(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </details>
);
