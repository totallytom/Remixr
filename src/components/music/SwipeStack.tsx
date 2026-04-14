import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { DiscoveryCard } from './DiscoveryCard';
import { MusicService } from '../../services/musicService';
import type { Track } from '../../store/useStore';

const PRELOAD_THRESHOLD = 2;
const FETCH_PAGE_SIZE = 8;
const MAX_VISIBLE = 3;

export interface SwipeStackProps {
  /** Initial tracks to show (e.g. from filtered list or first fetch). Only used for initial state and when resetKey changes. */
  initialTracks: Track[];
  /** Called when user swipes; use direction === 'right' for like/save to DB */
  onSwipe: (direction: 'left' | 'right', track: Track) => void;
  /** Optional: fetch more tracks when queue is low. If omitted, uses MusicService.getTracks(10, offset). */
  fetchMore?: (offset: number) => Promise<Track[]>;
  /** Optional genre filter for default fetchMore (uses getTracksByGenre when set) */
  genre?: string | null;
  /** When this value changes, queue and currentIndex reset to initialTracks and 0. Pass e.g. genre + search so reset only happens when filters change. */
  resetKey?: string;
}

export const SwipeStack: React.FC<SwipeStackProps> = ({
  initialTracks,
  onSwipe,
  fetchMore: fetchMoreProp,
  genre,
  resetKey,
}) => {
  const [queue, setQueue] = useState<Track[]>(initialTracks);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Only reset queue and index when genre or search actually changes (resetKey), not on every re-render
  const prevResetKeyRef = useRef<string | undefined>(resetKey);
  useEffect(() => {
    if (resetKey === undefined) return;
    if (prevResetKeyRef.current === resetKey) return;
    prevResetKeyRef.current = resetKey;
    setQueue(initialTracks);
    setCurrentIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: use initialTracks only when resetKey changes
  }, [resetKey]);

  // When parent loads tracks after mount (e.g. Discover fetches async), sync queue so cards appear
  useEffect(() => {
    if (initialTracks.length > 0 && queue.length === 0) {
      setQueue(initialTracks);
      setCurrentIndex(0);
    }
  }, [initialTracks, queue.length]);

  const visibleTracks = queue.slice(currentIndex, currentIndex + MAX_VISIBLE);
  const remainingCount = queue.length - currentIndex;

  const loadMore = useCallback(async () => {
    if (isLoadingMore) return;
    const offset = queue.length;
    setIsLoadingMore(true);
    try {
      let next: Track[];
      if (fetchMoreProp) {
        next = await fetchMoreProp(offset);
      } else if (genre) {
        next = await MusicService.getTracksByGenre(genre, FETCH_PAGE_SIZE, offset);
      } else {
        next = await MusicService.getTracks(FETCH_PAGE_SIZE, offset);
      }
      if (next.length > 0) {
        setQueue((prev) => [...prev, ...next]);
      }
    } catch (e) {
      console.error('SwipeStack: failed to fetch more tracks', e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [queue.length, fetchMoreProp, genre, isLoadingMore]);

  // Pre-load when 2 or fewer tracks left in queue
  useEffect(() => {
    if (remainingCount <= PRELOAD_THRESHOLD && !isLoadingMore) {
      loadMore();
    }
  }, [remainingCount, isLoadingMore, loadMore]);

  const handleSwipe = useCallback(
    (direction: 'left' | 'right', track: Track) => {
      onSwipe(direction, track);
      setCurrentIndex((prev) => prev + 1);
    },
    [onSwipe]
  );

  const handleBack = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const canGoBack = currentIndex > 0;

  return (
    <div className="relative w-full max-w-sm mx-auto aspect-[3/4] min-h-[320px] sm:min-h-[420px] flex items-center justify-center overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        {visibleTracks.map((track, index) => (
          <DiscoveryCard
            key={track.id}
            track={track}
            isTop={index === 0}
            stackIndex={index}
            zIndex={MAX_VISIBLE - index}
            onSwipe={handleSwipe}
          />
        ))}
      </AnimatePresence>
      {visibleTracks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-4 sm:px-6">
          <div className="w-full max-w-sm aspect-[3/4] flex flex-col items-center justify-center rounded-3xl bg-dark-800 border border-white/10 shadow-2xl text-dark-400 overflow-hidden">
            {isLoadingMore ? (
              <>
                <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-center px-6 text-base sm:text-lg">Finding more music...</p>
              </>
            ) : (
              <>
                <span className="text-5xl sm:text-6xl opacity-50 mb-3">♪</span>
                <p className="text-center px-6 text-sm sm:text-base">No more tracks to swipe.</p>
                <p className="text-center px-6 text-xs sm:text-sm mt-1">Try another genre or search.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Back button - go to previous track */}
      {canGoBack && (
        <button
          type="button"
          onClick={handleBack}
          className="absolute bottom-10 left-8 z-[20] flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors shadow-lg"
          aria-label="Go back to previous track"
        >
          <ChevronLeft size={24} />
        </button>
      )}
    </div>
  );
};

export default SwipeStack;
