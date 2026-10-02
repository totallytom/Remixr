import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { AnimatePresence } from 'framer-motion';
import { DiscoveryCard, type CardPlayback } from './DiscoveryCard';
import { MusicService } from '../../services/musicService';
import type { Track } from '../../store/useStore';

const PRELOAD_THRESHOLD = 2;
const FETCH_PAGE_SIZE = 8;
const MAX_VISIBLE = 3;

export interface SwipeStackHandle {
  /** Swipe the top card as if dragged (buttons / keyboard). */
  swipe: (direction: 'left' | 'right') => void;
  /** Bring back the previous card. */
  back: () => void;
  canGoBack: () => boolean;
}

export interface SwipeStackProps {
  /** Initial tracks to show. Only used for initial state and when resetKey changes. */
  initialTracks: Track[];
  /** Called when a card leaves the deck. */
  onSwipe: (direction: 'left' | 'right', track: Track) => void;
  /** Optional: fetch more tracks when the deck runs low. Defaults to getTracks / getTracksByGenre. */
  fetchMore?: (offset: number) => Promise<Track[]>;
  genre?: string | null;
  /** When this changes, the deck resets to initialTracks. */
  resetKey?: string;
  /** Called whenever a different track reaches the top (null when empty). */
  onTopChange?: (track: Track | null) => void;
  /** Playback state for a given track (shared preview player). */
  playbackFor?: (track: Track) => CardPlayback;
  blind?: boolean;
}

export const SwipeStack = forwardRef<SwipeStackHandle, SwipeStackProps>(({
  initialTracks,
  onSwipe,
  fetchMore: fetchMoreProp,
  genre,
  resetKey,
  onTopChange,
  playbackFor,
  blind = false,
}, ref) => {
  const [queue, setQueue] = useState<Track[]>(initialTracks);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [exitRequest, setExitRequest] = useState<{ dir: 'left' | 'right'; trackId: string } | null>(null);
  const exhaustedRef = useRef(false);

  const prevResetKeyRef = useRef<string | undefined>(resetKey);
  useEffect(() => {
    if (resetKey === undefined) return;
    if (prevResetKeyRef.current === resetKey) return;
    prevResetKeyRef.current = resetKey;
    setQueue(initialTracks);
    setCurrentIndex(0);
    exhaustedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: use initialTracks only when resetKey changes
  }, [resetKey]);

  // Parent loaded tracks after mount.
  useEffect(() => {
    if (initialTracks.length > 0 && queue.length === 0) {
      setQueue(initialTracks);
      setCurrentIndex(0);
    }
  }, [initialTracks, queue.length]);

  const visibleTracks = queue.slice(currentIndex, currentIndex + MAX_VISIBLE);
  const remainingCount = queue.length - currentIndex;
  const top = visibleTracks[0] ?? null;

  useEffect(() => {
    onTopChange?.(top);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top?.id]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || exhaustedRef.current) return;
    const offset = queue.length;
    setIsLoadingMore(true);
    try {
      let next: Track[];
      if (fetchMoreProp) next = await fetchMoreProp(offset);
      else if (genre) next = await MusicService.getTracksByGenre(genre, FETCH_PAGE_SIZE, offset);
      else next = await MusicService.getTracks(FETCH_PAGE_SIZE, offset);

      const seen = new Set(queue.map((t) => t.id));
      const fresh = next.filter((t) => !seen.has(t.id));
      if (fresh.length > 0) setQueue((prev) => [...prev, ...fresh]);
      else exhaustedRef.current = true;
    } catch (e) {
      console.error('SwipeStack: failed to fetch more tracks', e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [queue, fetchMoreProp, genre, isLoadingMore]);

  useEffect(() => {
    if (remainingCount <= PRELOAD_THRESHOLD && !isLoadingMore) loadMore();
  }, [remainingCount, isLoadingMore, loadMore]);

  const handleSwipe = useCallback(
    (direction: 'left' | 'right', track: Track) => {
      setExitRequest(null);
      onSwipe(direction, track);
      setCurrentIndex((prev) => prev + 1);
    },
    [onSwipe],
  );

  useImperativeHandle(ref, () => ({
    swipe: (dir) => {
      if (top && !exitRequest) setExitRequest({ dir, trackId: top.id });
    },
    back: () => {
      setExitRequest(null);
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    },
    canGoBack: () => currentIndex > 0,
  }), [top, exitRequest, currentIndex]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <AnimatePresence initial={false}>
        {visibleTracks.map((track, index) => (
          <DiscoveryCard
            key={track.id}
            track={track}
            isTop={index === 0}
            stackIndex={index}
            zIndex={MAX_VISIBLE - index}
            onSwipe={handleSwipe}
            exitRequest={index === 0 && exitRequest && exitRequest.trackId === track.id ? exitRequest.dir : null}
            blind={blind}
            playback={index === 0 ? playbackFor?.(track) : undefined}
          />
        )).reverse()}
      </AnimatePresence>

      {visibleTracks.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-black bg-white text-center px-6"
          style={{ boxShadow: '8px 8px 0 0 #000' }}>
          {isLoadingMore ? (
            <>
              <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-bold text-black">Finding more music…</p>
            </>
          ) : (
            <>
              <span className="font-kotra text-6xl text-black mb-2">♪</span>
              <p className="font-bold text-black">You've heard everything here.</p>
              <p className="text-sm text-black/60 mt-1">Try another genre, or come back later for new uploads.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
});

SwipeStack.displayName = 'SwipeStack';

export default SwipeStack;
