import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

/** Aggregated hype for a track (from track_hype_map). */
export interface HypeMap {
  total: number;
  listeners: number;
  duration: number;
  /** Counts per equal slice of the track. */
  buckets: number[];
  /** Busiest moment, in seconds. */
  peakSec: number | null;
  /** The signed-in user's own hype moments (seconds). */
  mine: number[];
}

export type HypeResult = 'ok' | 'too_soon' | 'limit';

export const HYPE_BUCKETS = 48;
const EMPTY: HypeMap = { total: 0, listeners: 0, duration: 0, buckets: [], peakSec: null, mine: [] };

export class HypeService {
  static async getMap(trackId: string, buckets = HYPE_BUCKETS): Promise<HypeMap> {
    const { data, error } = await supabase.rpc('track_hype_map', { p_track_id: trackId, p_buckets: buckets });
    if (error) throw new Error(error.message);
    const d = (data ?? {}) as Record<string, any>;
    return {
      total: Number(d.total ?? 0),
      listeners: Number(d.listeners ?? 0),
      duration: Number(d.duration ?? 0),
      buckets: Array.isArray(d.buckets) ? d.buckets.map(Number) : [],
      peakSec: d.peak_sec == null ? null : Number(d.peak_sec),
      mine: Array.isArray(d.mine) ? d.mine.map(Number) : [],
    };
  }

  static async hype(trackId: string, atSec: number): Promise<HypeResult> {
    const { data, error } = await supabase.rpc('hype_moment', { p_track_id: trackId, p_at_sec: Math.max(0, atSec) });
    if (error) throw new Error(error.message);
    return data as HypeResult;
  }
}

export function formatHypeTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Hype map for the playing track + a hype() action with an optimistic update.
 * Reloads when the track changes.
 */
export function useHype(trackId: string | null | undefined, duration: number) {
  const [map, setMap] = useState<HypeMap>(EMPTY);
  const [lastResult, setLastResult] = useState<{ result: HypeResult | 'error'; at: number; nonce: number } | null>(null);
  const nonce = useRef(0);

  useEffect(() => {
    setMap(EMPTY);
    if (!trackId) return;
    let cancelled = false;
    HypeService.getMap(trackId).then((m) => { if (!cancelled) setMap(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, [trackId]);

  const hype = useCallback(async (atSec: number) => {
    if (!trackId) return;
    const n = ++nonce.current;
    try {
      const result = await HypeService.hype(trackId, atSec);
      setLastResult({ result, at: atSec, nonce: n });
      if (result === 'ok') {
        setMap((m) => {
          const len = m.buckets.length || HYPE_BUCKETS;
          const dur = Math.max(m.duration || duration || 1, atSec + 1);
          const buckets = m.buckets.length ? [...m.buckets] : new Array(len).fill(0);
          const i = Math.min(len - 1, Math.floor((atSec / dur) * len));
          buckets[i] += 1;
          return {
            ...m,
            duration: dur,
            buckets,
            total: m.total + 1,
            listeners: m.mine.length === 0 ? m.listeners + 1 : m.listeners,
            mine: [...m.mine, atSec],
          };
        });
      }
    } catch {
      setLastResult({ result: 'error', at: atSec, nonce: n });
    }
  }, [trackId, duration]);

  return { map, hype, lastResult };
}
