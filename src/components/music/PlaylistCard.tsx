import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Plus,
  Trash2,
  Edit3,
  X,
  Save
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Playlist, Track } from '../../store/useStore';
import { MusicService } from '../../services/musicService';
interface PlaylistCardProps {
  playlist: Playlist;
  onPlay?: (playlist: Playlist) => void;
  onEdit?: (playlist: Playlist) => void;
  onDelete?: (playlistId: string) => void;
  onAddTrack?: (playlist: Playlist) => void;
  onUpdatePlaylist?: (playlistId: string, updates: any) => void;
  onRemoveTrack?: (playlistId: string, trackId: string) => void;
  showActions?: boolean;
}

const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  onPlay,
  onEdit,
  onDelete,
  onAddTrack,
  onUpdatePlaylist,
  onRemoveTrack,
  showActions = true
}) => {
  const { user, playlists, setPlaylists, deletePlaylist, playPlaylist } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: playlist.name
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handlePlay = () => {
    if (onPlay) {
      onPlay(playlist);
    } else {
      playPlaylist(playlist);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim()) return;
    
    setIsUpdating(true);
    try {
      if (onUpdatePlaylist) {
        await onUpdatePlaylist(playlist.id, {
          name: editForm.name
        });
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update playlist:', error);
      alert('Failed to update playlist. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      name: playlist.name
    });
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (onDelete) {
      onDelete(playlist.id);
    } else {
      deletePlaylist(playlist.id);
    }
    setShowDeleteConfirm(false);
  };

  const formatDuration = (tracks: Track[]) => {
    const totalSeconds = tracks.reduce((acc, track) => acc + track.duration, 0);
    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  const getCoverImage = () => {
    if (playlist.cover) {
      return playlist.cover;
    }
    if (playlist.tracks.length > 0 && playlist.tracks[0].cover) {
      return playlist.tracks[0].cover;
    }
    return 'https://images.unsplash.com/photo-1493225457124a3eb161ffa5?w=400&h=400&fit=crop';
  };

  const isOwner = user?.id === playlist.createdBy;
  const canEdit = isOwner || playlist.collaborators.includes(user?.id || '');

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="playlist-card rounded-2xl bg-white p-[7px] cursor-pointer w-full max-w-[220px]"
        style={{ border: '3px solid #000', boxShadow: '4px 4px 0 0 #000' }}
        onClick={() => {/* Parent handles navigation */}}
      >
        <div className="rounded-xl border-2 border-black overflow-hidden bg-white">
          {/* Square cover art */}
          <div className="relative w-full bg-gray-800" style={{ paddingBottom: '100%' }}>
            <img
              src={getCoverImage()}
              alt={playlist.name}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.fallback-cover-playlist')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'fallback-cover-playlist absolute inset-0 flex items-center justify-center bg-gray-800 text-2xl';
                  fallback.textContent = '🎵';
                  parent.appendChild(fallback);
                }
              }}
              onLoad={(e) => {
                const target = e.target as HTMLImageElement;
                const parent = target.parentElement;
                const fallback = parent?.querySelector('.fallback-cover-playlist');
                if (fallback) fallback.remove();
              }}
            />

            {/* Track count / private badges */}
            <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-medium">
              {playlist.tracks.length}
            </div>
            {!playlist.isPublic && (
              <div className="absolute bottom-2 left-2 bg-violet-600 text-white text-[10px] px-1.5 py-0.5 rounded">
                Private
              </div>
            )}
          </div>

          <div className="h-0.5 bg-black" />

          {/* Playlist info */}
          <div className="p-2.5">
            <div className="font-bold text-[13px] text-black truncate">{playlist.name}</div>
            <p className="text-gray-700 text-[11px] truncate mt-0.5">
              {playlist.tracks.length} track{playlist.tracks.length !== 1 ? 's' : ''}
              {playlist.description && ` • ${playlist.description}`}
            </p>
            {playlist.tracks.length > 0 && (
              <span className="text-gray-500 text-[11px] mt-1 block">{formatDuration(playlist.tracks)}</span>
            )}

            {/* Action buttons row */}
            <div className="flex gap-1.5 mt-2.5" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); handlePlay(); }}
                className="flex-1 py-1.5 rounded-lg bg-black text-white flex items-center justify-center"
                title="Play playlist"
              >
                <Play size={15} fill="currentColor" />
              </button>
              {onAddTrack && showActions && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAddTrack(playlist); }}
                  className="flex-1 py-1.5 rounded-lg bg-white border border-black text-black flex items-center justify-center"
                  title="Add tracks"
                >
                  <Plus size={15} />
                </button>
              )}
              {canEdit && showActions && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleEdit(); }}
                  className="flex-1 py-1.5 rounded-lg bg-white border border-black text-black flex items-center justify-center"
                  title="Edit playlist"
                >
                  <Edit3 size={15} />
                </button>
              )}
              {canEdit && showActions && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  className="flex-1 py-1.5 rounded-lg bg-white border border-black text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                  title="Delete playlist"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Edit Playlist Modal */}
      {isEditing && canEdit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl border border-gray-200" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-black mb-4">Edit Playlist</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Playlist Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Playlist name"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
                  disabled={isUpdating || !editForm.name.trim()}
                  className="flex-1 bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isUpdating ? <span className="spinner w-4 h-4" /> : <Save size={16} />}
                  {isUpdating ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-black rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-black mb-4">Delete Playlist</h2>
            <p className="text-gray-500 mb-6">
              Are you sure you want to delete "{playlist.name}"? This action cannot be undone.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={e => { e.stopPropagation(); confirmDelete(); }}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                Delete
              </button>
              <button
                onClick={e => { e.stopPropagation(); setShowDeleteConfirm(false); }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-black px-4 py-2 rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PlaylistCard; 