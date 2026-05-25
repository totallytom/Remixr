import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SwipeStack } from '../components/music/SwipeStack';
import { useStore } from '../store/useStore';
import type { Track } from '../store/useStore';
import { MusicService } from '../services/musicService';
import { BoostService } from '../services/boostService';

function shuffleTracks<T>(array: T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const Discover: React.FC = () => {
  const { addToQueue, user: currentUser } = useStore();
  const navigate = useNavigate();
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<Track[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  useEffect(() => {
    const loadGenres = async () => {
      try {
        const genres = await MusicService.getAvailableGenres();
        setAvailableGenres(genres);
      } catch (error) {
        console.error('Failed to load genres:', error);
        setAvailableGenres(['Electronic', 'Pop', 'Rock', 'Hip Hop', 'R&B', 'Jazz', 'Classical']);
      }
    };
    loadGenres();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const LOAD_TIMEOUT_MS = 15000;

    const loadTracks = async () => {
      setIsLoadingTracks(true);
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Load timeout')), LOAD_TIMEOUT_MS)
        );

        const [boosted, regular] = await Promise.race([
          Promise.all([
            BoostService.getBoostedTracks(4).catch(() => [] as Track[]),
            MusicService.getTracks(14),
          ]),
          timeoutPromise,
        ]);

        if (cancelled) return;

        // Boosted tracks lead the stack; deduplicate against regular pool
        const boostedIds = new Set(boosted.map((t) => t.id));
        const uniqueRegular = shuffleTracks(regular.filter((t) => !boostedIds.has(t.id)));
        const composed = [...boosted, ...uniqueRegular].slice(0, 16);

        setAllTracks(composed);
        if (selectedGenre) {
          const genreFiltered = composed.filter((t) => t.genre === selectedGenre);
          setFilteredTracks(genreFiltered.length ? genreFiltered : shuffleTracks(composed));
        } else {
          setFilteredTracks(composed);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load tracks:', error);
        setAllTracks([]);
        setFilteredTracks([]);
      } finally {
        if (!cancelled) setIsLoadingTracks(false);
      }
    };
    loadTracks();
    return () => {
      cancelled = true;
    };
  }, [selectedGenre]);

  const handleSwipe = useCallback(
    (direction: 'left' | 'right', track: Track) => {
      if (direction === 'right') {
        addToQueue(track);
        if (currentUser) {
          MusicService.recordPlayHistory(currentUser.id, track.id, 0, false).catch(console.error);
          MusicService.addTrackLike(track.id, currentUser.id).catch(() => {});
        }
      }
    },
    [addToQueue, currentUser]
  );

  return (
    <div className="flex flex-col h-full lg:block lg:px-3 lg:py-4 lg:space-y-6 max-w-[100vw] overflow-x-hidden">
      {/* Guest sign-up banner */}
      {!currentUser && (
        <div className="flex-shrink-0 mx-1 mb-2 flex items-center justify-between gap-3 px-4 py-2.5 bg-primary-900/30 border border-primary-700/40 rounded-xl">
          <p className="text-sm text-primary-300 min-w-0 truncate">Sign up to save your likes and track history</p>
          <button
            onClick={() => navigate('/signup')}
            className="flex-shrink-0 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-full text-xs font-medium transition-colors"
          >
            Sign Up Free
          </button>
        </div>
      )}
      {/* Header — compact on mobile, full on desktop */}
      <div className="px-1 pt-1 pb-2 lg:px-0 lg:pt-0 lg:mb-4 flex-shrink-0">
        <h2 className="text-xl lg:text-2xl font-bold text-white font-kyobo">Swipe to discover</h2>
        <p className="text-white text-xs lg:text-sm hidden lg:block mt-1">
          Swipe right to like and add to queue, left to skip. More tracks load as you swipe.
        </p>
      </div>

      {/* Swipe area — fills remaining height on mobile */}
      <section className="flex-1 min-h-0 lg:flex-none lg:mb-8">
        {isLoadingTracks ? (
          <div className="w-full h-full lg:aspect-[3/4] lg:max-w-sm lg:mx-auto lg:min-h-[420px] flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <SwipeStack
            initialTracks={filteredTracks}
            onSwipe={handleSwipe}
            genre={selectedGenre}
            resetKey={selectedGenre ?? 'all'}
          />
        )}
      </section>
    </div>
  );
};

export default Discover;
