import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

const FRAME_SEC = 1 / 30;
const DEFAULT_SNIPPET_DURATION = 20;

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 100);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function snapToFrame(sec: number): number {
  return Math.round(sec / FRAME_SEC) * FRAME_SEC;
}

export interface SnippetEditorProps {
  audioSrc: string;
  duration: number;
  previewStartSec: number;
  previewDurationSec: number;
  onPreviewChange: (startSec: number, durationSec: number) => void;
  className?: string;
}

type DragMode = 'left' | 'right' | 'body' | null;

export const SnippetEditor: React.FC<SnippetEditorProps> = ({
  audioSrc,
  duration,
  previewStartSec,
  previewDurationSec,
  onPreviewChange,
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStartRef = useRef({ start: 0, duration: 0, x: 0 });

  const maxStart = Math.max(0, duration - 1);
  const clampedStart = Math.min(maxStart, Math.max(0, previewStartSec));
  const maxDuration = Math.min(DEFAULT_SNIPPET_DURATION, Math.max(1, duration - clampedStart));
  const clampedDuration = Math.min(maxDuration, Math.max(1, Math.min(previewDurationSec, duration - clampedStart)));
  const endSec = clampedStart + clampedDuration;

  const leftPct = duration > 0 ? (clampedStart / duration) * 100 : 0;
  const widthPct = duration > 0 ? (clampedDuration / duration) * 100 : 100;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const stopAt = clampedStart + clampedDuration;
    const onTimeUpdate = () => {
      if (el.currentTime >= stopAt - 0.1) {
        el.pause();
        el.currentTime = clampedStart;
        setIsPlaying(false);
      }
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => el.removeEventListener('timeupdate', onTimeUpdate);
  }, [clampedStart, clampedDuration]);

  useEffect(() => {
    if (!isPlaying || !audioRef.current) return;
    audioRef.current.currentTime = clampedStart;
    audioRef.current.play().catch(() => setIsPlaying(false));
  }, [audioSrc, isPlaying]);

  const handlePlayPause = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.currentTime = clampedStart;
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const clientXToTime = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track || duration <= 0) return 0;
    const rect = track.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return snapToFrame(x * duration);
  }, [duration]);

  const handlePointerDown = useCallback((e: React.PointerEvent, mode: DragMode) => {
    e.preventDefault();
    if (!mode) return;
    setDragMode(mode);
    dragStartRef.current = {
      start: clampedStart,
      duration: clampedDuration,
      x: e.clientX,
    };
    trackRef.current?.setPointerCapture(e.pointerId);
  }, [clampedStart, clampedDuration]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragMode || !trackRef.current || duration <= 0) return;
    const time = clientXToTime(e.clientX);
    const { start, duration: dur } = dragStartRef.current;

    if (dragMode === 'left') {
      const newStart = Math.max(0, Math.min(endSec - 1, time));
      const newDur = Math.min(DEFAULT_SNIPPET_DURATION, endSec - newStart);
      onPreviewChange(snapToFrame(newStart), Math.max(1, snapToFrame(newDur)));
    } else if (dragMode === 'right') {
      const newEnd = Math.max(clampedStart + 1, Math.min(duration, time));
      const newDur = Math.min(DEFAULT_SNIPPET_DURATION, newEnd - clampedStart);
      onPreviewChange(clampedStart, Math.max(1, snapToFrame(newDur)));
    } else if (dragMode === 'body') {
      const half = dur / 2;
      let newStart = snapToFrame(time - half);
      newStart = Math.max(0, Math.min(duration - dur, newStart));
      onPreviewChange(newStart, dur);
      dragStartRef.current = { ...dragStartRef.current, start: newStart };
    }
  }, [dragMode, duration, endSec, clampedStart, clientXToTime, onPreviewChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (trackRef.current && e.pointerId !== undefined) {
      try { trackRef.current.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    setDragMode(null);
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">Discover preview</h4>
          <p className="text-xs text-gray-500 mt-0.5">Drag the purple segment or its edges (20s max)</p>
        </div>
        <button
          type="button"
          onClick={handlePlayPause}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 transition-colors shadow-sm"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          {isPlaying ? 'Pause' : 'Play'} snippet
        </button>
      </div>
      <audio ref={audioRef} src={audioSrc} onEnded={() => setIsPlaying(false)} />

      {/* Draggable timeline: full track with snippet */}
      <div className="space-y-1.5">
        <div
          ref={trackRef}
          className="relative h-12 rounded-xl bg-gray-200 overflow-visible select-none touch-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Gray track background */}
          <div className="absolute inset-0 rounded-xl" />

          {/* Purple snippet (draggable body + left/right handles) */}
          <div
            className="absolute inset-y-0 rounded-lg bg-violet-500 shadow-md flex items-stretch"
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          >
            {/* Left handle */}
            <div
              role="slider"
              aria-label="Snippet start"
              tabIndex={0}
              className="w-3 flex-shrink-0 cursor-ew-resize hover:bg-violet-600/50 rounded-l-lg transition-colors"
              onPointerDown={(e) => handlePointerDown(e, 'left')}
            />
            {/* Middle: drag to move */}
            <div
              className="flex-1 cursor-grab active:cursor-grabbing min-w-0"
              onPointerDown={(e) => handlePointerDown(e, 'body')}
            />
            {/* Right handle */}
            <div
              role="slider"
              aria-label="Snippet end"
              tabIndex={0}
              className="w-3 flex-shrink-0 cursor-ew-resize hover:bg-violet-600/50 rounded-r-lg transition-colors"
              onPointerDown={(e) => handlePointerDown(e, 'right')}
            />
          </div>

          {/* Time labels overlay */}
          <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none text-xs font-medium text-gray-600">
            <span>{formatTime(0)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        <div className="flex justify-between text-xs text-violet-600 font-medium">
          <span>Start {formatTime(clampedStart)}</span>
          <span>End {formatTime(endSec)}</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
        Preview: <span className="font-medium text-gray-700">{formatTime(clampedStart)}</span>
        {' → '}
        <span className="font-medium text-gray-700">{formatTime(endSec)}</span>
        {' '}
        <span className="text-gray-400">(track {formatTime(duration)})</span>
      </p>
    </div>
  );
};

export default SnippetEditor;
