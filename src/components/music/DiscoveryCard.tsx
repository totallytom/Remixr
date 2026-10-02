import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Play, Pause, Heart, X } from 'lucide-react';
import type { Track } from '../../store/useStore';
import AudioBars from '../discover/AudioBars';
import LicenseBadge from './LicenseBadge';

export interface CardPlayback {
  /** This card's track is the one loaded in the shared preview player. */
  isCurrent: boolean;
  isPlaying: boolean;
  progress: number;
  onToggle: () => void;
  getAnalyser: () => AnalyserNode | null;
}

interface DiscoveryCardProps {
  track: Track;
  onSwipe: (direction: 'left' | 'right', track: Track) => void;
  /** When false, card is stacked behind and not draggable */
  isTop?: boolean;
  /** Stack order (0 = top). Used for scale/offset when !isTop */
  stackIndex?: number;
  zIndex?: number;
  /** Set by the deck when a button/keyboard swipe is requested for the top card. */
  exitRequest?: 'left' | 'right' | null;
  /** Blind mode: hide cover, title and artist so the track is judged by sound. */
  blind?: boolean;
  playback?: CardPlayback;
}

const SWIPE_THRESHOLD = 100;
const EXIT_OFFSET = 520;
const DEFAULT_TRACK_COVER = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';

/** Stable two-colour gradient per track for Blind mode. */
function mysteryGradient(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const a = h % 360;
  const b = (a + 70 + (h >> 8) % 90) % 360;
  return `linear-gradient(135deg, hsl(${a} 85% 70%), hsl(${b} 85% 60%))`;
}

const DiscoveryCardComponent: React.FC<DiscoveryCardProps> = ({
  track,
  onSwipe,
  isTop = true,
  stackIndex = 0,
  zIndex: zIndexProp,
  exitRequest = null,
  blind = false,
  playback,
}) => {
  const x = useMotionValue(0);
  const [isExiting, setIsExiting] = useState(false);
  const exitingRef = useRef(false);

  const rotate = useTransform(x, [-240, 240], [-18, 18]);
  const likeOpacity = useTransform(x, [40, 140], [0, 1]);
  const nopeOpacity = useTransform(x, [-40, -140], [0, 1]);

  const exit = (direction: 'left' | 'right') => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setIsExiting(true);
    animate(x, direction === 'right' ? EXIT_OFFSET : -EXIT_OFFSET, {
      duration: 0.3,
      ease: 'easeIn',
      onComplete: () => onSwipe(direction, track),
    });
  };

  // Button / keyboard swipes.
  useEffect(() => {
    if (isTop && exitRequest) exit(exitRequest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitRequest, isTop]);

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (exitingRef.current) return;
    const { offset, velocity } = info;
    if (offset.x > SWIPE_THRESHOLD || velocity.x > 800) exit('right');
    else if (offset.x < -SWIPE_THRESHOLD || velocity.x < -800) exit('left');
    else animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
  };

  const artwork = track.cover || DEFAULT_TRACK_COVER;
  const gradient = useMemo(() => mysteryGradient(track.id), [track.id]);
  const playing = Boolean(playback?.isCurrent && playback.isPlaying);
  const progress = playback?.isCurrent ? playback.progress : 0;

  return (
    <motion.div
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale: isTop ? 1 : Math.max(0.88, 1 - stackIndex * 0.05),
        y: isTop ? 0 : stackIndex * 14,
        zIndex: zIndexProp !== undefined ? zIndexProp : (isTop ? 10 : 10 - stackIndex),
      }}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      drag={isTop && !isExiting ? 'x' : false}
      dragConstraints={{ left: -400, right: 400 }}
      dragElastic={0.25}
      onDragEnd={handleDragEnd}
      whileTap={isTop ? { scale: 1.015 } : undefined}
      className="absolute inset-0 flex items-center justify-center touch-none"
    >
      <div
        className={`relative w-full h-full flex flex-col rounded-3xl overflow-hidden border-2 border-black bg-white ${isTop ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
        style={{ boxShadow: isTop ? '8px 8px 0 0 #000' : '4px 4px 0 0 #000' }}
      >
        {/* Like / Skip stamps */}
        {isTop && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute top-5 left-5 z-20 flex items-center gap-1.5 px-3 py-1.5 border-2 border-black rounded-xl bg-green-300 -rotate-12 shadow-[3px_3px_0_0_#000]"
            >
              <Heart size={20} className="fill-black" />
              <span className="font-kotra text-2xl text-black">LIKE</span>
            </motion.div>
            <motion.div
              style={{ opacity: nopeOpacity }}
              className="absolute top-5 right-5 z-20 flex items-center gap-1.5 px-3 py-1.5 border-2 border-black rounded-xl bg-red-300 rotate-12 shadow-[3px_3px_0_0_#000]"
            >
              <X size={20} strokeWidth={3} />
              <span className="font-kotra text-2xl text-black">SKIP</span>
            </motion.div>
          </>
        )}

        {/* Artwork (or mystery art in Blind mode) */}
        <div className="relative flex-1 min-h-0 border-b-2 border-black overflow-hidden">
          {blind ? (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: gradient }}>
              <span className="font-kotra text-[8rem] leading-none text-black/80 select-none">?</span>
            </div>
          ) : (
            <img
              src={artwork}
              alt={track.title}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
          )}

          {/* Visualiser over the bottom of the art */}
          {isTop && playback && (
            <div className="absolute inset-x-0 bottom-0 h-24 pointer-events-none bg-gradient-to-t from-black/50 to-transparent">
              <AudioBars
                getAnalyser={playback.getAnalyser}
                active={playing}
                color="#ffffff"
                className="absolute inset-x-4 bottom-3 h-16 w-[calc(100%-2rem)]"
              />
            </div>
          )}

          {isTop && track.audioUrl && playback && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); playback.onToggle(); }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-full border-2 border-black bg-white text-black text-sm font-bold shadow-[3px_3px_0_0_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all"
              aria-label={playing ? 'Pause preview' : 'Play preview'}
            >
              {playing ? <Pause size={16} /> : <Play size={16} className="fill-black" />}
              {playing ? 'Pause' : 'Preview'}
            </button>
          )}
        </div>

        {/* Info */}
        <div className="flex-shrink-0 px-5 pt-3 pb-4 bg-white">
          {blind ? (
            <>
              <p className="font-kotra text-2xl text-black leading-tight">Mystery track</p>
              <p className="text-sm text-black/60">Like it to reveal who made it.</p>
            </>
          ) : (
            <>
              <p className="font-kotra text-2xl text-black leading-tight truncate">{track.title}</p>
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm text-black/70 truncate">{track.artist}</p>
                <LicenseBadge license={(track as { licenseType?: string }).licenseType} className="flex-shrink-0" />
              </div>
            </>
          )}
          <div className="mt-2 flex items-center gap-2">
            {track.genre && (
              <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border-2 border-black bg-teal-300 text-black">
                {track.genre}
              </span>
            )}
            {/* Preview progress */}
            <div className="flex-1 h-2.5 rounded-full border-2 border-black bg-white overflow-hidden" aria-hidden="true">
              <div className="h-full bg-black transition-[width] duration-150" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const DiscoveryCard = React.memo(DiscoveryCardComponent);
export default DiscoveryCard;
