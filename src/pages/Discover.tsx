import React, { useState, useEffect, useCallback } from 'react';
import { SwipeStack } from '../components/music/SwipeStack';
import { useStore } from '../store/useStore';
import type { Track } from '../store/useStore';
import { MusicService } from '../services/musicService';

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
        const tracks = await Promise.race([
          MusicService.getTracks(12),
          timeoutPromise,
        ]);
        if (cancelled) return;
        const shuffled = shuffleTracks(tracks);
        setAllTracks(shuffled);
        if (selectedGenre) {
          setFilteredTracks(shuffleTracks(shuffled.filter((t) => t.genre === selectedGenre)));
        } else {
          setFilteredTracks(shuffled);
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
    <div className="px-3 py-4 sm:px-5 sm:py-5 md:p-6 space-y-6 sm:space-y-8 max-w-[100vw] overflow-x-hidden">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
      </div>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-4 font-kyobo">Swipe to discover</h2>
        <h2 className="text-dark-400 text-sm mb-4">
          Swipe right to like and add to queue, left to skip. More tracks load as you swipe.
        </h2>
        {isLoadingTracks ? (
          <div className="relative w-full max-w-sm mx-auto aspect-[3/4] min-h-[320px] sm:min-h-[420px] flex items-center justify-center">
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
