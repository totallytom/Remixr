import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Play, Pause } from 'lucide-react';
import type { Track } from '../../store/useStore';

interface DiscoveryCardProps {
  track: Track;
  onSwipe: (direction: 'left' | 'right', track: Track) => void;
  /** When false, card is stacked behind and not draggable */
  isTop?: boolean;
  /** Stack order (0 = top). Used for scale/offset when !isTop */
  stackIndex?: number;
  /** Optional explicit z-index (e.g. from SwipeStack: MAX_VISIBLE - index) */
  zIndex?: number;
}

const SWIPE_THRESHOLD = 100;
const EXIT_OFFSET = 400;
const DEFAULT_PREVIEW_DURATION = 20;
const DEFAULT_TRACK_COVER = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';

const DiscoveryCardComponent: React.FC<DiscoveryCardProps> = ({ track, onSwipe, isTop = true, stackIndex = 0, zIndex: zIndexProp }) => {
  const x = useMotionValue(0);
  const [isExiting, setIsExiting] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const previewStart = Math.max(0, (track as { previewStartSec?: number }).previewStartSec ?? 0);
  const previewDuration = Math.min(
    DEFAULT_PREVIEW_DURATION,
    Math.max(1, (track as { previewDurationSec?: number }).previewDurationSec ?? DEFAULT_PREVIEW_DURATION)
  );
  const previewEnd = previewStart + previewDuration;

  useEffect(() => {
    const audio = document.createElement('audio');
    previewAudioRef.current = audio;
    return () => {
      audio.pause();
      previewAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = previewAudioRef.current;
    if (!el) return;
    const onTimeUpdate = () => {
      if (el.currentTime >= previewEnd - 0.1) {
        el.pause();
        el.currentTime = previewStart;
        setIsPreviewPlaying(false);
      }
    };
    const interval = setInterval(() => {
      if (el.paused) return;
      if (el.currentTime >= previewEnd - 0.1) {
        el.pause();
        el.currentTime = previewStart;
        setIsPreviewPlaying(false);
      }
    }, 100);
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      clearInterval(interval);
    };
  }, [previewStart, previewEnd]);

  const togglePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!track.audioUrl) return;
    const el = previewAudioRef.current;
    if (!el) return;
    if (isPreviewPlaying) {
      el.pause();
      setIsPreviewPlaying(false);
    } else {
      el.src = track.audioUrl;
      el.currentTime = previewStart;
      el.play().then(() => setIsPreviewPlaying(true)).catch(() => {});
    }
  };

  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);

  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-50, -150], [0, 1]);

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (isExiting) return;
    const { offset, velocity } = info;
    const targetX = offset.x > SWIPE_THRESHOLD
      ? EXIT_OFFSET
      : offset.x < -SWIPE_THRESHOLD
        ? -EXIT_OFFSET
        : 0;

    if (targetX !== 0) {
      setIsExiting(true);
      const direction = targetX > 0 ? 'right' : 'left';
      animate(x, targetX, {
        type: 'spring',
        stiffness: 300,
        damping: 30,
        onComplete: () => {
          onSwipe(direction, track);
        },
      });
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  };

  const artwork = track.cover || DEFAULT_TRACK_COVER;

  return (
    <motion.div
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        opacity: isTop ? opacity : 1,
        scale: isTop ? 1 : Math.max(0.85, 1 - stackIndex * 0.05),
        y: isTop ? 0 : stackIndex * 6,
        zIndex: zIndexProp !== undefined ? zIndexProp : (isTop ? 10 : 10 - stackIndex),
      }}
      drag={isTop && !isExiting ? 'x' : false}
      dragConstraints={{ left: -400, right: 400 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      whileTap={isTop ? { scale: 1.02 } : undefined}
      className="absolute inset-0 flex items-center justify-center px-4 sm:px-6 touch-none"
    >
      <div className={`w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-neutral-900 relative ${isTop ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}>
        {/* Like stamp - only on top card */}
        {isTop && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute top-6 left-6 sm:top-8 sm:left-8 z-10 border-4 border-green-500 rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 rotate-[-20deg] bg-black/30"
            >
              <span className="text-green-500 font-black text-2xl sm:text-4xl uppercase tracking-wide">Like</span>
            </motion.div>
            <motion.div
              style={{ opacity: nopeOpacity }}
              className="absolute top-6 right-6 sm:top-8 sm:right-8 z-10 border-4 border-red-500 rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 rotate-[20deg] bg-black/30"
            >
              <span className="text-red-500 font-black text-2xl sm:text-4xl uppercase tracking-wide">Nope</span>
            </motion.div>
          </>
        )}

        {/* Artwork & info */}
        {artwork ? (
          <img
            src={artwork}
            alt={track.title}
            className="w-full h-full aspect-square object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-600/30 to-dark-800 flex items-center justify-center pointer-events-none">
            <span className="text-6xl text-white/50">♪</span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black via-black/70 to-transparent">
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight truncate font-kyobo">{track.title}</h2>
          <p className="text-base sm:text-lg text-white/80 truncate">{track.artist}</p>
          {track.genre && (
            <p className="text-xs sm:text-sm text-primary-400 mt-0.5 truncate">{track.genre}</p>
          )}
        </div>
        {isTop && track.audioUrl && (
          <button
            type="button"
            onClick={togglePreview}
            className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-10 flex items-center justify-center w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-colors"
            aria-label={isPreviewPlaying ? 'Pause preview' : 'Play preview'}
          >
            {isPreviewPlaying ? <Pause size={22} /> : <Play size={22} />}
          </button>
        )}
      </div>
    </motion.div>
  );
};

export const DiscoveryCard = React.memo(DiscoveryCardComponent);
export default DiscoveryCard;
