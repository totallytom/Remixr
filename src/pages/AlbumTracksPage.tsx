import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Play, Clock, ArrowLeft } from 'lucide-react';
import { createDisplayName } from '../utils/debugUtils';
import { MusicService } from '../services/musicService';
import { AlbumService, Album } from '../services/albumService';
import { Track } from '../store/useStore';

const AlbumTracksPage: React.FC = () => {
  const { albumId } = useParams<{ albumId: string }>();
  const { playTrack, playQueue } = useStore();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAlbumAndTracks = async () => {
      if (!albumId) return;
      setIsLoading(true);
      try {
        const [albumData, albumTracks] = await Promise.all([
          AlbumService.getAlbumById(albumId),
          MusicService.getTracksByAlbum(albumId)
        ]);
        setAlbum(albumData || null);
        setTracks(albumTracks || []);
      } catch (error) {
        console.error('Failed to load album:', error);
        setAlbum(null);
        setTracks([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadAlbumAndTracks();
  }, [albumId]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '—';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handlePlayAlbum = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0]);
    }
  };

  const handlePlayTrack = (track: Track) => {
    playTrack(track);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p>Loading album...</p>
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="p-8 text-center text-white">
        <h2 className="text-2xl font-bold mb-4">Album not found</h2>
        <button
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          onClick={() => navigate(-1)}
        >
          Go back
        </button>
      </div>
    );
  }

  const albumCover =
    album.cover ||
    (tracks.length > 0 ? tracks[0].cover : null) ||
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      {/* Header - same layout as PlaylistTracksPage */}
      <div className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-violet-900/50 to-indigo-900/40 md:bg-dark-800 border-b border-violet-700/50 md:border-dark-700">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:space-x-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 sm:static p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors self-start"
            aria-label="Go back"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="relative w-48 h-48 rounded-lg overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--color-border)' }}>
            <img
              src={albumCover}
              alt={album.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.fallback-cover-album')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'fallback-cover-album w-full h-full flex items-center justify-center bg-dark-700 text-6xl';
                  fallback.textContent = '🎵';
                  parent.appendChild(fallback);
                }
              }}
            />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white/80 uppercase tracking-wider mb-1">Album</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">{album.title}</h1>
            <p className="text-dark-300 mb-4">{album.artist}</p>
            <div className="flex items-center gap-4 text-sm text-dark-400">
              <span>{album.genre}</span>
              <span>{tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="px-4 sm:px-6 md:px-8 py-4 bg-dark-900 border-b border-dark-700">
        <div className="flex items-center space-x-4">
          <button
            onClick={handlePlayAlbum}
            className="w-14 h-14 bg-primary-600 hover:bg-primary-500 rounded-full flex items-center justify-center transition-colors text-white"
            disabled={tracks.length === 0}
          >
            <Play size={24} className="text-white ml-1" fill="currentColor" />
          </button>
          {tracks.length > 1 && (
            <button
              onClick={() => playQueue(tracks)}
              className="px-4 py-2 text-dark-300 hover:text-white transition-colors text-sm"
            >
              Play all ({tracks.length} tracks)
            </button>
          )}
        </div>
      </div>

      {/* Track list - same table layout as PlaylistTracksPage */}
      <div className="px-4 sm:px-6 md:px-8">
        <div className="hidden md:grid grid-cols-[50px_1fr_1fr_1fr_100px] gap-4 py-4 border-b border-dark-700 text-gray-400 text-sm font-medium">
          <div>#</div>
          <div>Title</div>
          <div>Album</div>
          <div>Date added</div>
          <div className="flex justify-center">
            <Clock size={16} />
          </div>
        </div>

        {tracks.length === 0 ? (
          <div className="py-12 text-center text-dark-400">
            No tracks in this album yet.
          </div>
        ) : (
          <div>
            {tracks.map((track, index) => (
              <div
                key={createDisplayName(track.id)}
                className="grid grid-cols-[50px_1fr_1fr_1fr_100px] gap-4 py-3 hover:bg-dark-800 rounded group cursor-pointer transition-colors md:border-l-0 border-l-4 border-l-emerald-500/70 bg-dark-800/50 md:bg-transparent"
                onClick={() => handlePlayTrack(track)}
              >
                <div className="flex items-center justify-center">
                  <span className="text-gray-400 group-hover:hidden">{index + 1}</span>
                  <button type="button" className="hidden group-hover:block text-white" aria-label={`Play ${track.title}`}>
                    <Play size={16} fill="currentColor" />
                  </button>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-dark-700 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={track.cover}
                      alt={track.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-white font-medium">{track.title}</div>
                    <div className="text-gray-400 text-sm">{track.artist}</div>
                  </div>
                </div>

                <div className="flex items-center text-gray-400 hidden md:block">
                  {track.album || album.title}
                </div>

                <div className="flex items-center text-gray-400 hidden md:block">
                  {formatDate(track.createdAt)}
                </div>

                <div className="flex items-center justify-center text-gray-400">
                  {formatDuration(track.duration)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlbumTracksPage;
