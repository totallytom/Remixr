import React, { useState, useRef, useEffect } from 'react';
import { Music, Play, Pause, Plus, Check } from 'lucide-react';
import { Track } from '../../store/useStore';
import { useStore } from '../../store/useStore';
import { MusicService } from '../../services/musicService';

interface ChatMusicShareProps {
  track: Track;
  onPlay?: (track: Track) => void;
}

const ChatMusicShare: React.FC<ChatMusicShareProps> = ({ track, onPlay }) => {
  const { player, playTrack, pauseTrack, user, playlists } = useStore();
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isCurrentlyPlaying = player.currentTrack?.id === track.id && player.isPlaying;

  // Close menu when clicking outside
  useEffect(() => {
    if (!showPlaylistMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPlaylistMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPlaylistMenu]);

  const handleAddToPlaylist = async (playlistId: string) => {
    try {
      await MusicService.addTrackToPlaylist(playlistId, track.id);
      setAddedId(playlistId);
      setTimeout(() => {
        setAddedId(null);
        setShowPlaylistMenu(false);
      }, 1000);
    } catch (error: any) {
      const msg = error?.message ?? '';
      if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
        setAddedId(playlistId);
        setTimeout(() => { setAddedId(null); setShowPlaylistMenu(false); }, 1000);
      } else {
        console.error('Failed to add to playlist:', error);
      }
    }
  };

  const userPlaylists = playlists.filter((p: any) => p.createdBy === user?.id);

  const handlePlayPause = () => {
    if (isCurrentlyPlaying) {
      pauseTrack();
      return;
    }
    if (onPlay) {
      onPlay(track);
    } else {
      if (!track.audioUrl) {
        alert('No audio file available for this track');
        return;
      }
      try {
        playTrack(track);
        if (user) {
          MusicService.recordPlayHistory(user.id, track.id, 0, false).catch(console.error);
        }
      } catch (error) {
        console.error('Failed to play track:', error);
        alert('Failed to play track. Please try again.');
      }
    }
  };

  return (
    <div className="w-full">
      {/* Main card with gradient border using box-shadow instead of overlapping elements */}
      <div className="bg-dark-900 rounded-xl p-3 shadow-xl border border-dark-700" 
           style={{
             boxShadow: '0 0 20px rgba(251, 146, 60, 0.3), 0 0 40px rgba(236, 72, 153, 0.2), 0 0 60px rgba(147, 51, 234, 0.1), inset 0 0 0 1px rgba(251, 146, 60, 0.1)'
           }}>
        
        {/* Shared Track Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-gradient-to-br from-pink-500 to-orange-500 rounded-lg flex items-center justify-center shadow-md">
              <Music size={14} className="text-black" />
            </div>
                      <div>
            <div className="text-xs font-semibold text-black">Shared Track</div>
            <div className="text-xs text-gray-400">via Music</div>
          </div>
          </div>
        </div>

        {/* Track Information */}
        <div className="flex items-start space-x-3 mb-3">
          {/* Album Art */}
          <div className="w-14 h-14 rounded-lg overflow-hidden shadow-md flex-shrink-0 border border-dark-600">
            {track.cover ? (
              <img 
                src={track.cover} 
                alt={track.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                <Music size={20} className="text-gray-400" />
              </div>
            )}
          </div>
          
          {/* Track Details */}
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-bold text-black mb-1 truncate">{track.title}</h4>
            <p className="text-sm text-gray-300 mb-1 truncate">{track.artist || 'Unknown Artist'}</p>
            {track.album && (
              <p className="text-xs text-gray-500 truncate">{track.album}</p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700 mb-3"></div>

        {/* Action Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePlayPause}
              className="w-7 h-7 bg-dark-800 border border-gray-600 rounded-full flex items-center justify-center hover:bg-dark-700 hover:border-gray-500 transition-colors"
              title={isCurrentlyPlaying ? 'Pause' : 'Play'}
            >
              {isCurrentlyPlaying ? (
                <Pause size={10} className="text-black" />
              ) : (
                <Play size={10} className="text-black ml-0.5" />
              )}
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowPlaylistMenu((v) => !v)}
                className="w-7 h-7 bg-dark-800 border border-gray-600 rounded-full flex items-center justify-center hover:bg-dark-700 hover:border-gray-500 transition-colors"
                title="Add to playlist"
              >
                <Plus size={10} className="text-black" />
              </button>
              {showPlaylistMenu && (
                <div className="absolute bottom-9 left-0 z-50 min-w-[160px] bg-dark-800 border border-dark-600 rounded-xl shadow-2xl overflow-hidden">
                  <p className="px-3 py-2 text-xs text-gray-500 border-b border-dark-700">Add to playlist</p>
                  {userPlaylists.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-500">No playlists yet</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto">
                      {userPlaylists.map((pl: any) => {
                        const alreadyIn = pl.tracks?.some((t: any) => t.id === track.id);
                        return (
                          <button
                            key={pl.id}
                            onClick={() => !alreadyIn && handleAddToPlaylist(pl.id)}
                            disabled={alreadyIn}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors text-left ${
                              alreadyIn
                                ? 'text-gray-500 cursor-default'
                                : 'text-black hover:bg-dark-700 cursor-pointer'
                            }`}
                          >
                            <span className="truncate">{pl.name}</span>
                            {alreadyIn
                              ? <Check size={13} className="text-gray-500 flex-shrink-0" />
                              : addedId === pl.id && <Check size={13} className="text-green-400 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Status */}
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-400">Available</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMusicShare;