import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, Volume2, VolumeX, X } from 'lucide-react';
import { clipLength, fmtTime, MAX_REMIX_SEC, type Layer } from './engine';

/** Fixed lane colours, in layer order (identity, not data). */
export const LANE_COLORS = ['#5eead4', '#fcd34d', '#c4b5fd', '#fda4af'];

const SNAP = 0.05;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─── Waveform ────────────────────────────────────────────────────────────────
const ClipWave: React.FC<{ layer: Layer; width: number; height: number }> = ({ layer, width, height }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !layer.peaks || !layer.buffer || width <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, width, height);
    g.fillStyle = 'rgba(0,0,0,0.72)';
    const peaks = layer.peaks;
    const dur = layer.buffer.duration;
    const from = (layer.trimStart / dur) * peaks.length;
    const to = (layer.trimEnd / dur) * peaks.length;
    const bar = 2, gap = 1;
    const n = Math.max(1, Math.floor(width / (bar + gap)));
    const mid = height / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.floor(from + ((to - from) * i) / n);
      const b = Math.max(a + 1, Math.floor(from + ((to - from) * (i + 1)) / n));
      let m = 0;
      for (let k = a; k < b && k < peaks.length; k++) m = Math.max(m, peaks[k]);
      const h = Math.max(1, m * (height - 6));
      g.fillRect(i * (bar + gap), mid - h / 2, bar, h);
    }
  }, [layer.peaks, layer.buffer, layer.trimStart, layer.trimEnd, width, height]);
  return <canvas ref={ref} style={{ width, height }} className="block pointer-events-none" aria-hidden="true" />;
};

// ─── Clip (drag to move, edges to trim) ──────────────────────────────────────
type DragMode = 'move' | 'trim-start' | 'trim-end';

const Clip: React.FC<{
  layer: Layer;
  index: number;
  pps: number;
  height: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<Layer>) => void;
}> = ({ layer, index, pps, height, selected, onSelect, onChange }) => {
  const drag = useRef<{ mode: DragMode; x: number; orig: Layer } | null>(null);
  const len = clipLength(layer);
  const width = Math.max(8, len * pps);
  const color = LANE_COLORS[index % LANE_COLORS.length];
  const sourceDur = layer.buffer?.duration ?? layer.track.duration;

  const begin = (mode: DragMode) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, orig: layer };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dt = (e.clientX - d.x) / pps;
    const o = d.orig;
    const oLen = clipLength(o);
    if (d.mode === 'move') {
      onChange({ offset: snap(clamp(o.offset + dt, 0, MAX_REMIX_SEC - oLen)) });
    } else if (d.mode === 'trim-start') {
      // Keep the clip's end fixed on the timeline.
      const delta = clamp(dt, Math.max(-o.trimStart, -o.offset), oLen - 1);
      onChange({ trimStart: snap(o.trimStart + delta), offset: snap(o.offset + delta) });
    } else {
      const maxEnd = Math.min(sourceDur, o.trimStart + (MAX_REMIX_SEC - o.offset));
      onChange({ trimEnd: snap(clamp(o.trimEnd + dt, o.trimStart + 1, maxEnd)) });
    }
  };
  const end = () => { drag.current = null; };

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 5 : 0.5;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      onChange({ offset: snap(clamp(layer.offset + dir * step, 0, MAX_REMIX_SEC - len)) });
    }
  };

  const fiW = Math.min(layer.fadeIn, len / 2) * pps;
  const foW = Math.min(layer.fadeOut, len / 2) * pps;
  const dim = layer.muted;

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={`${layer.track.title} clip. Starts at ${fmtTime(layer.offset)}. Use arrow keys to move it.`}
      aria-valuemin={0}
      aria-valuemax={MAX_REMIX_SEC}
      aria-valuenow={Math.round(layer.offset)}
      aria-valuetext={`starts at ${fmtTime(layer.offset)}`}
      onKeyDown={onKey}
      onPointerDown={begin('move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={`absolute top-1 rounded-lg border-2 border-black overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none
        focus:outline-none focus-visible:ring-4 focus-visible:ring-black/30 ${selected ? 'shadow-[3px_3px_0_0_#000]' : ''}`}
      style={{ left: layer.offset * pps, width, height: height - 8, background: color, opacity: dim ? 0.45 : 1 }}
    >
      <div className="absolute inset-x-0 top-0 px-2 py-0.5 text-[11px] font-bold text-black truncate pointer-events-none">
        {layer.track.title}
      </div>
      <div className="absolute inset-x-0 bottom-0" style={{ top: 18 }}>
        <ClipWave layer={layer} width={width - 4} height={height - 8 - 22} />
      </div>
      {/* Fade overlays */}
      {fiW > 1 && (
        <svg className="absolute left-0 top-0 pointer-events-none" width={fiW} height={height - 8} aria-hidden="true">
          <polygon points={`0,0 ${fiW},0 0,${height - 8}`} fill="rgba(255,255,255,0.55)" />
          <line x1={0} y1={height - 8} x2={fiW} y2={0} stroke="#000" strokeWidth={1.5} />
        </svg>
      )}
      {foW > 1 && (
        <svg className="absolute right-0 top-0 pointer-events-none" width={foW} height={height - 8} aria-hidden="true">
          <polygon points={`0,0 ${foW},0 ${foW},${height - 8}`} fill="rgba(255,255,255,0.55)" />
          <line x1={0} y1={0} x2={foW} y2={height - 8} stroke="#000" strokeWidth={1.5} />
        </svg>
      )}
      {/* Trim handles */}
      <span
        onPointerDown={begin('trim-start')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
        className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-black/0 hover:bg-black/25 touch-none"
        title="Drag to trim the start"
      />
      <span
        onPointerDown={begin('trim-end')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-black/0 hover:bg-black/25 touch-none"
        title="Drag to trim the end"
      />
    </div>
  );
};

// ─── Timeline ────────────────────────────────────────────────────────────────
export const Timeline: React.FC<{
  layers: Layer[];
  position: number;
  length: number;
  zoom: number;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onChange: (key: string, patch: Partial<Layer>) => void;
  onRemove: (key: string) => void;
  onSeek: (sec: number) => void;
}> = ({ layers, position, length, zoom, selectedKey, onSelect, onChange, onRemove, onSeek }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(0);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setViewW(e.contentRect.width));
    ro.observe(el);
    setViewW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Fit the mix (plus some headroom) to the view at zoom 1.
  const span = Math.min(MAX_REMIX_SEC, Math.max(30, Math.ceil((length + 10) / 10) * 10));
  const pps = viewW > 0 ? (viewW / span) * zoom : 10;
  const innerW = Math.max(viewW, Math.min(MAX_REMIX_SEC, span) * pps);
  const LANE_H = 84;

  const tickEvery = [1, 2, 5, 10, 15, 30, 60].find((s) => s * pps >= 70) ?? 60;
  const ticks: number[] = [];
  for (let t = 0; t <= innerW / pps; t += tickEvery) ticks.push(t);

  const seekFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(clamp((e.clientX - rect.left) / pps, 0, Math.max(0, length)));
  };

  return (
    <div className="flex">
      {/* Lane headers */}
      <div className="flex-shrink-0 w-28 sm:w-44 border-r-2 border-black">
        <div className="h-7 border-b-2 border-black" />
        {layers.map((l, i) => (
          <div
            key={l.key}
            className={`flex flex-col justify-center gap-1 px-2 border-b-2 border-black last:border-b-0 cursor-pointer ${selectedKey === l.key ? 'bg-black/5' : ''}`}
            style={{ height: LANE_H }}
            onClick={() => onSelect(l.key)}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-3 h-3 rounded-sm border-2 border-black flex-shrink-0" style={{ background: LANE_COLORS[i % LANE_COLORS.length] }} />
              <span className="text-xs font-bold truncate text-black">{l.track.title}</span>
            </div>
            <span className="text-[11px] text-black/60 truncate">{l.track.artist}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(l.key, { muted: !l.muted }); }}
                aria-pressed={l.muted}
                title={l.muted ? 'Unmute' : 'Mute'}
                className={`w-6 h-6 rounded border-2 border-black flex items-center justify-center ${l.muted ? 'bg-black text-white' : 'bg-white text-black'}`}
              >
                {l.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(l.key, { solo: !l.solo }); }}
                aria-pressed={l.solo}
                title={l.solo ? 'Unsolo' : 'Solo (hear only soloed layers)'}
                className={`w-6 h-6 rounded border-2 border-black text-[10px] font-black ${l.solo ? 'bg-yellow-300' : 'bg-white'}`}
              >
                S
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(l.key); }}
                title="Remove layer"
                aria-label={`Remove ${l.track.title}`}
                className="w-6 h-6 rounded border-2 border-black bg-white flex items-center justify-center hover:bg-red-100"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Lanes */}
      <div ref={scroller} className="flex-1 min-w-0 overflow-x-auto">
        <div className="relative" style={{ width: innerW }}>
          {/* Ruler (click/drag to seek) */}
          <div
            className="relative h-7 border-b-2 border-black cursor-pointer select-none touch-none bg-black/[0.03]"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seekFromEvent(e); }}
            onPointerMove={(e) => { if (e.buttons) seekFromEvent(e); }}
            aria-label="Timeline ruler: click to move the playhead"
          >
            {ticks.map((t) => (
              <span key={t} className="absolute top-0 h-full border-l border-black/25 pl-1 text-[10px] leading-7 text-black/60 tabular-nums" style={{ left: t * pps }}>
                {fmtTime(t)}
              </span>
            ))}
            {length > 0 && (
              <span className="absolute top-0 h-full border-l-2 border-dashed border-black/50" style={{ left: length * pps }} title="End of mix" />
            )}
          </div>

          {layers.map((l, i) => (
            <div key={l.key} className="relative border-b-2 border-black last:border-b-0" style={{ height: LANE_H }}>
              {l.status === 'loading' && (
                <div className="absolute inset-0 flex items-center gap-2 px-3 text-xs font-semibold text-black/60">
                  <Loader2 size={14} className="animate-spin" /> Loading audio…
                </div>
              )}
              {l.status === 'error' && (
                <div className="absolute inset-0 flex items-center gap-2 px-3 text-xs font-semibold text-red-700">
                  <AlertTriangle size={14} /> {l.error || "Couldn't load this track"}
                </div>
              )}
              {l.status === 'ready' && (
                <Clip
                  layer={l}
                  index={i}
                  pps={pps}
                  height={LANE_H}
                  selected={selectedKey === l.key}
                  onSelect={() => onSelect(l.key)}
                  onChange={(p) => onChange(l.key, p)}
                />
              )}
            </div>
          ))}

          {/* Playhead */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-red-600 pointer-events-none" style={{ left: position * pps }} aria-hidden="true">
            <span className="absolute -top-0.5 -left-[5px] w-3 h-3 bg-red-600 rotate-45" />
          </div>
        </div>
      </div>
    </div>
  );
};
