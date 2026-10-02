import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame } from 'lucide-react';
import type { HypeMap, HypeResult } from '../../services/hypeService';
import { formatHypeTime } from '../../services/hypeService';

/**
 * Heat map of hype moments, drawn as bars along a progress bar.
 * Taller/brighter = more listeners hyped that part of the track.
 */
export const HypeStrip: React.FC<{
  map: HypeMap;
  tone?: 'light' | 'dark';
  height?: number;
  className?: string;
}> = ({ map, tone = 'light', height = 14, className = '' }) => {
  const max = Math.max(1, ...map.buckets);
  if (map.total === 0 || map.buckets.length === 0) return null;
  const peakPct = map.peakSec != null && map.duration ? (map.peakSec / map.duration) * 100 : null;

  return (
    <div
      className={`relative flex items-end gap-px pointer-events-none ${className}`}
      style={{ height }}
      role="img"
      aria-label={`Hype map: ${map.total} hype${map.total === 1 ? '' : 's'} from ${map.listeners} listener${map.listeners === 1 ? '' : 's'}${
        map.peakSec != null ? `, peaking at ${formatHypeTime(map.peakSec)}` : ''
      }`}
    >
      {map.buckets.map((n, i) => {
        const v = n / max;
        return (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-[height] duration-300"
            style={{
              height: n === 0 ? 0 : `${Math.max(18, v * 100)}%`,
              background: tone === 'dark'
                ? `rgba(251, 146, 60, ${0.35 + v * 0.65})`
                : `rgba(234, 88, 12, ${0.3 + v * 0.7})`,
            }}
          />
        );
      })}
      {peakPct != null && (
        <span
          className="absolute -top-4 text-[10px] leading-none -translate-x-1/2"
          style={{ left: `${Math.min(97, Math.max(3, peakPct))}%` }}
          aria-hidden="true"
        >
          🔥
        </span>
      )}
    </div>
  );
};

const RESULT_TEXT: Record<HypeResult | 'error', string> = {
  ok: '',
  too_soon: 'Already hyped this moment',
  limit: 'Max hypes for this track',
  error: 'Couldn’t save — try again',
};

/** 🔥 button: hype the moment you're hearing right now. */
export const HypeButton: React.FC<{
  onHype: () => void;
  lastResult: { result: HypeResult | 'error'; nonce: number } | null;
  disabled?: boolean;
  disabledReason?: string;
  count?: number;
  className?: string;
  size?: number;
}> = ({ onHype, lastResult, disabled, disabledReason, count, className = '', size = 18 }) => {
  const [bursts, setBursts] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!lastResult) return;
    if (lastResult.result === 'ok') {
      setBursts((b) => [...b, lastResult.nonce]);
      const id = lastResult.nonce;
      setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 900);
      setMessage(null);
    } else {
      setMessage(RESULT_TEXT[lastResult.result]);
      const t = setTimeout(() => setMessage(null), 1800);
      return () => clearTimeout(t);
    }
  }, [lastResult]);

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={onHype}
        disabled={disabled}
        className={`relative flex items-center justify-center gap-1 transition-transform active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        title={disabled ? disabledReason : 'Hype this moment'}
        aria-label={disabled ? disabledReason : 'Hype this moment'}
      >
        <Flame size={size} className="text-orange-500" fill="currentColor" />
        {typeof count === 'number' && count > 0 && <span className="text-xs font-bold">{count}</span>}
      </button>
      <AnimatePresence>
        {bursts.map((id) => (
          <motion.span
            key={id}
            initial={{ y: 0, opacity: 1, scale: 0.8 }}
            animate={{ y: -36, opacity: 0, scale: 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 text-lg"
            aria-hidden="true"
          >
            🔥
          </motion.span>
        ))}
      </AnimatePresence>
      {message && (
        <span role="status" className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold px-2 py-1 rounded-md border-2 border-black bg-white text-black shadow-[2px_2px_0_0_#000]">
          {message}
        </span>
      )}
    </div>
  );
};
