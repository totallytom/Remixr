import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Heart, 
  MoreVertical, 
  Users, 
  Clock,
  Music,
  Plus,
  Trash2,
  Edit3,
  Settings,
  X,
  Save,
  Check
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Playlist, Track } from '../../store/useStore';
import { AuthService } from '../../services/authService';
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
  compact?: boolean;
}

const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  onPlay,
  onEdit,
  onDelete,
  onAddTrack,
  onUpdatePlaylist,
  onRemoveTrack,
  showActions = true,
  compact = false
}) => {
  const { user, playPlaylist, playlists, setPlaylists, setTheme, setUser, setAuthenticated, setUserAvatar, deletePlaylist, addTrackToPlaylist, removeTrackFromPlaylist, playPlaylist: play, updateProfile, changePassword, changeUsername, changeEmail, togglePrivateAccount, setChats, setActiveChat, addMessage, createNewChat, deleteChat, addComment, likeComment, unlikeComment, deleteComment, deletePost, addTrackToPlaylist: addTrackTo, removeTrackFromPlaylist: removeTrackFrom, clearQueue, playQueue, toggleSidebar, setCurrentView, setSettingsOpen } = useStore();
  const [showMenu, setShowMenu] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: playlist.name
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Collaboration modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Dummy user search (replace with real API call)
  const handleSearch = async () => {
    setIsSearching(true);
    setInviteError('');
    try {
      const results = await AuthService.searchUsersByUsername(searchTerm);
      setSearchResults(results.filter(u => u.id !== user?.id && !playlist.collaborators.includes(u.id)));
      setIsSearching(false);
    } catch (e) {
      setInviteError('Search failed');
      setIsSearching(false);
    }
  };

  const handleAddCollaborator = async (userId: string) => {
    if (!playlist.collaborators.includes(userId)) {
      const newCollaborators = [...playlist.collaborators, userId];
      try {
        await MusicService.updatePlaylist(playlist.id, playlist.createdBy, { collaborators: newCollaborators });
        const updated = playlists.map(p =>
          p.id === playlist.id ? { ...p, collaborators: newCollaborators } : p
        );
        setPlaylists(updated);
      } catch (e) {
        alert('Failed to add collaborator.');
      }
    }
    setShowInviteModal(false);
  };

  const handleRemoveCollaborator = async (userId: string) => {
    const newCollaborators = playlist.collaborators.filter(id => id !== userId);
    try {
      await MusicService.updatePlaylist(playlist.id, playlist.createdBy, { collaborators: newCollaborators });
      const updated = playlists.map(p =>
        p.id === playlist.id ? { ...p, collaborators: newCollaborators } : p
      );
      setPlaylists(updated);
    } catch (e) {
      alert('Failed to remove collaborator.');
    }
  };

  const handlePlay = () => {
    if (onPlay) {
      onPlay(playlist);
    } else {
      playPlaylist(playlist);
    }
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setShowMenu(false);
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
    setShowMenu(false);
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
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`playlist-card flex items-center gap-3 lg:gap-4 rounded-lg overflow-hidden cursor-pointer group p-3
          border-l-4 border-l-violet-500 bg-violet-500/10 md:border-l-0 md:bg-dark-800 hover:bg-dark-700 transition-colors w-full min-w-0`}
        onClick={() => {/* Parent handles navigation */}}
        style={compact ? { maxWidth: 320 } : {}}
      >
        {/* Cover Image - same as Profile layout */}
        <div className="relative w-12 h-12 lg:w-16 lg:h-16 flex-shrink-0 rounded-md overflow-hidden bg-dark-700">
          <img
            src={getCoverImage()}
            alt={playlist.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent && !parent.querySelector('.fallback-cover-playlist')) {
                const fallback = document.createElement('div');
                fallback.className = 'fallback-cover-playlist w-full h-full flex items-center justify-center bg-dark-600 text-2xl';
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
          <div className="absolute top-0.5 left-0.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-medium">
            {playlist.tracks.length}
          </div>
          {!playlist.isPublic && (
            <div className="absolute top-0.5 right-0.5 bg-violet-600 text-white text-[10px] px-1 rounded">
              Private
            </div>
          )}
        </div>

        {/* Playlist Info - same as Profile */}
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold truncate text-sm lg:text-base font-kotra">{playlist.name}</div>
          <p className="text-dark-400 text-xs lg:text-sm truncate">
            {playlist.tracks.length} track{playlist.tracks.length !== 1 ? 's' : ''}
            {playlist.description && ` • ${playlist.description}`}
          </p>
        </div>

        {/* Actions - same as Profile */}
        <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); handlePlay(); }}
            className="p-2 lg:p-2.5 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors"
            title="Play playlist"
          >
            <Play size={16} className="lg:w-4 lg:h-4" fill="currentColor" />
          </button>
          {showActions && canEdit && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handleEdit(); }}
                className="p-2 text-dark-400 hover:text-white transition-colors rounded-full"
                title="Edit playlist"
              >
                <Edit3 size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                className="p-2 text-red-400 hover:text-red-300 transition-colors rounded-full"
                title="Delete playlist"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
          {onAddTrack && showActions && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddTrack(playlist); }}
              className="p-2 text-dark-400 hover:text-primary-400 transition-colors rounded-full"
              title="Add tracks"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </motion.div>

      {/* Edit Playlist Modal */}
      {isEditing && canEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md shadow-xl border border-dark-600" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Edit Playlist</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Playlist Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
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
                  className="px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-var(--color-text) mb-4">Delete Playlist</h2>
            <p className="text-var(--color-text-secondary) mb-6">
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
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors">
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