import React, { useState } from 'react';
import { Play, Edit3, Trash2, Music, Calendar } from 'lucide-react';
import { Album } from '../../services/albumService';
import { useStore } from '../../store/useStore';

interface AlbumCardProps {
  album: Album;
  onPlay?: (album: Album) => void;
  onOpen?: (album: Album) => void;
  onEdit?: (album: Album) => void;
  onDelete?: (albumId: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

const AlbumCard: React.FC<AlbumCardProps> = ({
  album,
  onPlay,
  onOpen,
  onEdit,
  onDelete,
  showActions = true,
  compact = false
}) => {
  const { user } = useStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(album.id);
    } catch (error) {
      console.error('Failed to delete album:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const isOwner = user?.id === album.userId;

  if (compact) {
    return (
      <div className="flex items-center space-x-3 bg-dark-800 rounded-lg p-3 hover:bg-dark-700 transition-colors">
        <img
          src={album.cover}
          alt={album.title}
          className="w-12 h-12 rounded-md object-cover"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">{album.title}</h3>
          <p className="text-dark-400 text-sm truncate">{album.artist}</p>
        </div>
        <div className="flex items-center space-x-2">
          {onPlay && (
            <button
              onClick={() => onPlay(album)}
              className="p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors"
              title="Play album"
            >
              <Play size={16} />
            </button>
          )}
          {showActions && isOwner && (
            <>
              {onEdit && (
                <button
                  onClick={() => onEdit(album)}
                  className="p-2 text-dark-400 hover:text-white transition-colors"
                  title="Edit album"
                >
                  <Edit3 size={16} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-red-400 hover:text-red-300 transition-colors"
                  title="Delete album"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? () => onOpen(album) : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(album); } } : undefined}
      className={`bg-dark-800 rounded-lg overflow-hidden hover:bg-dark-700 transition-colors ${onOpen ? 'cursor-pointer' : ''}`}
    >
      {/* Album Cover */}
      <div className="relative aspect-square">
        <img
          src={album.cover}
          alt={album.title}
          className="w-full h-full object-cover"
        />
        {onPlay && (
          <button
            onClick={(e) => { e.stopPropagation(); onPlay(album); }}
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity"
          >
            <Play size={48} className="text-white" />
          </button>
        )}
        {album.price && (
          <div className="absolute top-2 right-2 bg-primary-600 text-white px-2 py-1 rounded-full text-sm font-medium">
            ${album.price}
          </div>
        )}
      </div>

      {/* Album Info */}
      <div className="p-4">
        <h3 className="text-white font-semibold text-lg mb-1 truncate" title={album.title}>
          {album.title}
        </h3>
        <p className="text-dark-300 mb-2 truncate" title={album.artist}>
          {album.artist}
        </p>
        
        <div className="flex items-center justify-between text-sm text-dark-400 mb-3">
          <span className="flex items-center space-x-1">
            <Music size={14} />
            <span>{album.trackCount || 0} tracks</span>
          </span>
          <span className="flex items-center space-x-1">
            <Calendar size={14} />
            <span>{new Date(album.createdAt).getFullYear()}</span>
          </span>
        </div>

        {album.description && (
          <p className="text-dark-400 text-sm line-clamp-2 mb-3" title={album.description}>
            {album.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="px-2 py-1 bg-dark-700 text-primary-400 text-xs rounded-full">
            {album.genre}
          </span>

          {showActions && isOwner && (
            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
              {onEdit && (
                <button
                  onClick={() => onEdit(album)}
                  className="p-2 text-dark-400 hover:text-white transition-colors"
                  title="Edit album"
                >
                  <Edit3 size={16} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-red-400 hover:text-red-300 transition-colors"
                  title="Delete album"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Delete Album</h2>
            <p className="text-dark-300 mb-6">
              Are you sure you want to delete "{album.title}"? This action cannot be undone and will also remove all associated tracks.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 bg-dark-700 text-white px-4 py-2 rounded-lg hover:bg-dark-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlbumCard;
