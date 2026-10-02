import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from '../store/useStore';

const DEFAULT_PREVIEW_SECONDS = 20;

export interface PreviewPlayer {
  /** Track currently loaded (playing or paused). */
  trackId: string | null;
  isPlaying: boolean;
  /** 0–1 through the preview window. */
  progress: number;
  play: (track: Track) => void;
  pause: () => void;
  toggle: (track: Track) => void;
  stop: () => void;
  /** Analyser for visualisers; null when the browser can't analyse this audio (e.g. no CORS). */
  getAnalyser: () => AnalyserNode | null;
}

function previewWindow(track: Track) {
  const t = track as Track & { previewStartSec?: number; previewDurationSec?: number };
  const start = Math.max(0, t.previewStartSec ?? 0);
  const length = Math.min(60, Math.max(1, t.previewDurationSec ?? DEFAULT_PREVIEW_SECONDS));
  return { start, end: start + length, length };
}

/**
 * One audio element shared by the whole Discover deck: plays each track's
 * preview snippet, reports progress, and feeds a Web Audio analyser for the
 * visualiser. If the audio can't be analysed (cross-origin without CORS), it
 * falls back to plain playback so sound never breaks.
 */
export function usePreviewPlayer(onEnded?: (trackId: string) => void): PreviewPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analysable = useRef(true);
  const windowRef = useRef({ start: 0, end: DEFAULT_PREVIEW_SECONDS, length: DEFAULT_PREVIEW_SECONDS });
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const [trackId, setTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const trackIdRef = useRef<string | null>(null);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const el = new Audio();
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    audioRef.current = el;
    return el;
  }, []);

  /** Create/resume the AudioContext inside the user's click (browsers require a gesture). */
  const ensureContext = useCallback(() => {
    if (!analysable.current) return;
    try {
      if (!ctxRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) { analysable.current = false; return; }
        ctxRef.current = new Ctx();
      }
      ctxRef.current.resume().catch(() => {});
    } catch {
      analysable.current = false;
    }
  }, []);

  /**
   * Route audio through the analyser — only once a CORS load has actually
   * succeeded. Routing a non-CORS file through Web Audio would silence it.
   */
  const attachAnalyser = useCallback((el: HTMLAudioElement) => {
    const ctx = ctxRef.current;
    if (!ctx || !analysable.current || analyserRef.current || el.crossOrigin !== 'anonymous') return;
    try {
      const source = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
    } catch {
      analysable.current = false;
    }
  }, []);

  const tick = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    const { start, end, length } = windowRef.current;
    if (el.currentTime >= end - 0.05) {
      el.pause();
      setIsPlaying(false);
      setProgress(1);
      if (trackIdRef.current) onEndedRef.current?.(trackIdRef.current);
      return;
    }
    setProgress(Math.min(1, Math.max(0, (el.currentTime - start) / length)));
  }, []);

  useEffect(() => {
    const el = ensureAudio();
    const onTime = () => tick();
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPlaying = () => attachAnalyser(el);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('pause', onPause);
    el.addEventListener('play', onPlay);
    el.addEventListener('playing', onPlaying);
    const interval = setInterval(() => { if (!el.paused) tick(); }, 120);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('playing', onPlaying);
      clearInterval(interval);
      el.pause();
      ctxRef.current?.close().catch(() => {});
    };
  }, [ensureAudio, tick, attachAnalyser]);

  const play = useCallback((track: Track) => {
    if (!track.audioUrl) return;
    const el = ensureAudio();
    const win = previewWindow(track);
    windowRef.current = win;

    const start = () => {
      el.currentTime = win.start;
      el.play().catch(() => setIsPlaying(false));
    };

    if (trackIdRef.current !== track.id) {
      trackIdRef.current = track.id;
      setTrackId(track.id);
      setProgress(0);
      // Fall back to non-CORS playback (no visualiser) if CORS loading fails.
      const onError = () => {
        if (el.crossOrigin && !analyserRef.current) {
          analysable.current = false;
          el.removeAttribute('crossorigin');
          el.src = track.audioUrl!;
          el.addEventListener('loadedmetadata', start, { once: true });
        }
      };
      el.addEventListener('error', onError, { once: true });
      el.src = track.audioUrl;
      el.addEventListener('loadedmetadata', start, { once: true });
    } else if (el.currentTime >= win.end - 0.1 || el.currentTime < win.start) {
      start();
    } else {
      el.play().catch(() => setIsPlaying(false));
    }

    ensureContext();
  }, [ensureAudio, ensureContext]);

  const pause = useCallback(() => { audioRef.current?.pause(); }, []);

  const toggle = useCallback((track: Track) => {
    if (trackIdRef.current === track.id && isPlaying) pause();
    else play(track);
  }, [isPlaying, pause, play]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const getAnalyser = useCallback(() => analyserRef.current, []);

  return { trackId, isPlaying, progress, play, pause, toggle, stop, getAnalyser };
}
