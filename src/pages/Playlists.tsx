import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Filter, 
  Music, 
  Heart,
  Clock,
  Users,
  Grid,
  List,
  PlusCircle,
  ListMusic,
  Trash2,
  Edit,
  Play,
  MoreVertical,
  X,
  Check,
  Mail,
  XCircle,
  Share2
} from 'lucide-react';
import { useStore } from '../store/useStore';
import PlaylistCard from '../components/music/PlaylistCard';
import { Playlist, Track } from '../store/useStore';
import { mockTracks } from '../data/mockData';
import { MusicService } from '../services/musicService';
import { useNavigate } from 'react-router-dom';

const Playlists: React.FC = () => {
  const { 
    user, 
    playlists, 
    setPlaylists,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    playPlaylist
  } = useStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddTrackModal, setShowAddTrackModal] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [availableTracks, setAvailableTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingPlaylist, setIsUpdatingPlaylist] = useState<string | null>(null);
  
  // Shared playlists and invitations
  const [sharedPlaylists, setSharedPlaylists] = useState<Playlist[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [selectedInvitation, setSelectedInvitation] = useState<any | null>(null);
  const [showInvitationModal, setShowInvitationModal] = useState(false);

  // Create playlist form
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    isPublic: true
  });
  const [isCreating, setIsCreating] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    loadPlaylists();
    
    // Listen for playlist changes
    const handlePlaylistsChanged = () => {
      loadPlaylists();
    };
    
    window.addEventListener('playlistsChanged', handlePlaylistsChanged);
    
    return () => {
      window.removeEventListener('playlistsChanged', handlePlaylistsChanged);
    };
  }, [user]);

  // Check for pending invitations and show modal on initial load
  useEffect(() => {
    if (!user || pendingInvitations.length === 0 || showInvitationModal) return;
    
    // Show modal if there are pending invitations
    if (pendingInvitations.length > 0 && !selectedInvitation) {
      setSelectedInvitation(pendingInvitations[0]);
      setShowInvitationModal(true);
    }
  }, [pendingInvitations.length, user]);

  const loadPlaylists = async () => {
    setIsLoading(true);
    try {
      if (user) {
        // 3 parallel calls: batch playlists+tracks, accepted invites, pending invites
        const [playlistsWithTracks, acceptedInvitations, pending] = await Promise.all([
          MusicService.getPlaylistsWithTracks(user.id),
          MusicService.getPlaylistInvitations(user.id, 'accepted'),
          MusicService.getPlaylistInvitations(user.id, 'pending'),
        ]);

        setPlaylists(playlistsWithTracks);
        setPendingInvitations(pending);

        // Load shared playlist details (accepted invitations)
        if (acceptedInvitations.length > 0) {
          const sharedPlaylistsData = await Promise.all(
            acceptedInvitations.map(async (invitation) => {
              try {
                const sharedPlaylist = await MusicService.getPlaylistById(invitation.playlists.id);
                return { ...sharedPlaylist, isShared: true, invitationId: invitation.id };
              } catch (error) {
                console.error(`Failed to load shared playlist ${invitation.playlists.id}:`, error);
                return null;
              }
            })
          );
          setSharedPlaylists(sharedPlaylistsData.filter(p => p !== null) as Playlist[]);
        } else {
          setSharedPlaylists([]);
        }
      }
    } catch (error) {
      console.error('Failed to load playlists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableTracks = async () => {
    try {
      const tracks = await MusicService.getTracks();
      setAvailableTracks(tracks);
    } catch (error) {
      console.error('Failed to load tracks:', error);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!user || !createForm.name.trim()) return;
    
    setIsCreating(true);
    try {
      const newPlaylist = await MusicService.createPlaylist({
        name: createForm.name,
        description: createForm.description,
        isPublic: createForm.isPublic,
        createdBy: user.id
      });
      setPlaylists([...playlists, newPlaylist]);
      // Reset form and close modal
      setCreateForm({ name: '', description: '', isPublic: true });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create playlist:', error);
      alert('Failed to create playlist. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!user) return;
    
    try {
      console.log('Deleting playlist:', playlistId, 'for user:', user.id);
      await MusicService.deletePlaylist(playlistId, user.id);
      
      // Update local state
      deletePlaylist(playlistId);
      
      // Also update the store's playlists array
      setPlaylists(playlists.filter(p => p.id !== playlistId));
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('playlistsChanged', { 
        detail: { playlistId, userId: user.id, action: 'deleted' }
      }));
    } catch (error) {
      console.error('Failed to delete playlist - Full error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete playlist. Please try again.';
      console.error('Error message:', errorMessage);
      alert(`Failed to delete playlist: ${errorMessage}\n\nPlease check the browser console for more details.`);
    }
  };

  const handleUpdatePlaylist = async (playlistId: string, updates: any) => {
    if (!user) return;
    
    setIsUpdatingPlaylist(playlistId);
    try {
      await MusicService.updatePlaylist(playlistId, user.id, updates);
      
      // Update local state
      // You might want to reload the playlist or update the store
      await loadPlaylists();
    } catch (error) {
      console.error('Failed to update playlist:', error);
      alert('Failed to update playlist. Please try again.');
    } finally {
      setIsUpdatingPlaylist(null);
    }
  };

  const handleAddTrackToPlaylist = async (playlistId: string, track: Track) => {
    try {
      await addTrackToPlaylist(playlistId, track);
      setShowAddTrackModal(false);
    } catch (error) {
      console.error('Failed to add track to playlist:', error);
      alert('Failed to add track to playlist. Please try again.');
    }
  };

  const handleRemoveTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    try {
      await removeTrackFromPlaylist(playlistId, trackId);
    } catch (error) {
      console.error('Failed to remove track from playlist:', error);
      alert('Failed to remove track from playlist. Please try again.');
    }
  };

  const openAddTrackModal = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setShowAddTrackModal(true);
    loadAvailableTracks();
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Defensive: ensure playlists is always an array
  const safePlaylists = Array.isArray(playlists) ? playlists : [];
  const safeSharedPlaylists = Array.isArray(sharedPlaylists) ? sharedPlaylists : [];
  
  // Combine own playlists and shared playlists
  const allPlaylists = [...safePlaylists, ...safeSharedPlaylists];

  const filteredPlaylists = allPlaylists.filter(playlist => 
    playlist.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    playlist.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAcceptInvitation = async (invitation: any) => {
    if (!user) return;
    
    try {
      await MusicService.acceptPlaylistInvitation(invitation.id, user.id);
      
      // Update pending invitations
      const updatedPending = pendingInvitations.filter(inv => inv.id !== invitation.id);
      setPendingInvitations(updatedPending);
      
      // If there are more pending invitations, show the next one, otherwise close modal
      if (updatedPending.length > 0) {
        setSelectedInvitation(updatedPending[0]);
      } else {
        setShowInvitationModal(false);
        setSelectedInvitation(null);
      }
      
      // Reload playlists to show the newly accepted shared playlist
      await loadPlaylists();
      
      alert('Invitation accepted! The playlist is now available in your playlists.');
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      alert(`Failed to accept invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    if (!user) return;
    
    try {
      await MusicService.declinePlaylistInvitation(invitationId, user.id);
      
      // Update pending invitations
      const updatedPending = pendingInvitations.filter(inv => inv.id !== invitationId);
      setPendingInvitations(updatedPending);
      
      // If there are more pending invitations, show the next one, otherwise close modal
      if (updatedPending.length > 0) {
        setSelectedInvitation(updatedPending[0]);
      } else {
        setShowInvitationModal(false);
        setSelectedInvitation(null);
      }
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      alert(`Failed to decline invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Add handler for clicking a playlist card
  const handlePlaylistClick = (playlist: Playlist) => {
    navigate(`/playlists/${playlist.id}`);
  };

  if (isLoading) {
    return (
      <div className="py-20 flex items-center flex-col gap-4 justify-center">
        <div className="spinner w-8 h-8"></div>
        <span className="ml-2 text-gray-500">Loading playlists...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col items-start">
          <h1 className="text-3xl py-4 font-bold gradient-text font-kyobo">
            My Playlists
          </h1>
          <h5 className="text-var(--color-text-secondary) font-kyobo">
            Organize and enjoy your music collections
          </h5>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-var(--color-warm) text-white rounded-lg hover:bg-var(--color-secondary) transition-all duration-300 flex items-center space-x-2 font-kyobo"
        >
          <PlusCircle size={20} />
          <h4>Create Playlist</h4>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between space-x-4">
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-var(--color-text-secondary)" size={20} />
          <input
            type="text"
            placeholder="Search playlists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-var(--color-surface) border-2 border-var(--color-border) rounded-lg text-var(--color-text) placeholder-var(--color-text-secondary) focus:outline-none focus:border-var(--color-warm)"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid' 
                ? 'bg-var(--color-warm) text-black' 
                : 'bg-var(--color-surface) text-var(--color-text-secondary) hover:text-var(--color-text)'
            }`}
          >
            <Grid size={20} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list' 
                ? 'bg-var(--color-warm) text-black' 
                : 'bg-var(--color-surface) text-var(--color-text-secondary) hover:text-var(--color-text)'
            }`}
          >
            <List size={20} />
          </button>
        </div>
      </div>

      {/* Pending Invitations Banner */}
      {pendingInvitations.length > 0 && (
        <div className="bg-blue-900 border border-blue-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Mail className="text-blue-400" size={20} />
              <div>
                <h3 className="text-white font-semibold">You have {pendingInvitations.length} pending playlist invitation{pendingInvitations.length > 1 ? 's' : ''}</h3>
                <p className="text-blue-200 text-sm">Click to view and respond</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (pendingInvitations.length > 0) {
                  setSelectedInvitation(pendingInvitations[0]);
                  setShowInvitationModal(true);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              View Invitations
            </button>
          </div>
        </div>
      )}

      {/* Playlists Grid */}
      {filteredPlaylists.length === 0 ? (
        <div className="text-center py-12">
          <Music className="mx-auto text-var(--color-text-secondary)" size={48} />
          <h3 className="text-xl font-bold text-var(--color-text) mt-4 mb-2">No playlists yet</h3>
          <p className="text-var(--color-text-secondary) mb-6">Create your first playlist to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-var(--color-warm) text-black rounded-lg hover:bg-var(--color-secondary) transition-all duration-300 flex items-center space-x-2 mx-auto"
          >
            <PlusCircle size={20} />
            <span>Create Playlist</span>
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {filteredPlaylists.map((playlist, index) => {
            const isShared = (playlist as any).isShared || safeSharedPlaylists.some(sp => sp.id === playlist.id);
            const isOwner = user && playlist.createdBy === user.id;
            return (
              <motion.div
                key={playlist.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handlePlaylistClick(playlist)}
                className="cursor-pointer relative"
              >
                {isShared && !isOwner && (
                  <div className="absolute top-2 right-2 z-10 bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 shadow-lg">
                    <Share2 size={12} />
                    <span>SharePlay</span>
                  </div>
                )}
                <PlaylistCard
                  playlist={playlist}
                  onPlay={playPlaylist}
                  onEdit={() => {}}
                  onDelete={isShared && !isOwner ? undefined : handleDeletePlaylist}
                  onAddTrack={openAddTrackModal}
                  onUpdatePlaylist={handleUpdatePlaylist}
                  onRemoveTrack={handleRemoveTrackFromPlaylist}
                  showActions={isOwner}
                />
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md relative">
            <div className="text-xl font-bold text-primary-500 mb-4">Create New Playlist</div>
            <div className="space-y-4">
              <div>
                <label className="block text-var(--color-text) font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 bg-var(--color-background) border border-var(--color-border) rounded-lg text-var(--color-text) focus:outline-none focus:border-var(--color-warm)"
                  placeholder="Enter playlist name"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" 
                  defaultChecked className="sr-only peer" 
                  checked={createForm.isPublic}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                  id="isPublic"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <label htmlFor="isPublic" className="text-sm text-var(--color-text)">
                  Make playlist public
                </label>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleCreatePlaylist}
                disabled={isCreating || !createForm.name.trim()}
                className="flex-1 bg-var(--color-warm) text-black px-4 py-2 rounded-lg hover:bg-var(--color-secondary) transition-colors disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Playlist'}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-var(--color-background) text-var(--color-text) px-4 py-2 rounded-lg hover:bg-var(--color-border) transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Track Modal */}
      {showAddTrackModal && selectedPlaylist && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-var(--color-surface) rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-var(--color-text)">
                Add Tracks to "{selectedPlaylist.name}"
              </h2>
              <button
                onClick={() => setShowAddTrackModal(false)}
                className="p-2 text-var(--color-text-secondary) hover:text-var(--color-text) transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-2">
                {availableTracks
                  .filter(track => !selectedPlaylist.tracks.find(t => t.id === track.id))
                  .map((track) => (
                    <div key={track.id} className="flex items-center space-x-3 p-3 bg-var(--color-background) rounded hover:bg-var(--color-border) transition-colors">
                      <img
                        src={track.cover}
                        alt={track.title}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-var(--color-text) truncate">{track.title}</p>
                        <p className="text-xs text-var(--color-text-secondary) truncate">{track.artist}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-var(--color-text-secondary)">{formatDuration(track.duration)}</span>
                        <button
                          onClick={() => handleAddTrackToPlaylist(selectedPlaylist.id, track)}
                          className="p-2 bg-var(--color-warm) text-black rounded-full hover:bg-var(--color-secondary) transition-colors"
                          title="Add to playlist"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-var(--color-border)">
              <button
                onClick={() => setShowAddTrackModal(false)}
                className="w-full bg-var(--color-background) text-var(--color-text) px-4 py-2 rounded-lg hover:bg-var(--color-border) transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invitation Modal */}
      {showInvitationModal && selectedInvitation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md relative">
            <button
              onClick={() => {
                setShowInvitationModal(false);
                setSelectedInvitation(null);
              }}
              className="absolute top-3 right-3 p-1 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="mb-4">
              <h2 className="text-xl font-bold text-black mb-2">Playlist Invitation</h2>
              <p className="text-gray-600 text-sm">
                You've been invited to collaborate on a playlist
              </p>
            </div>

            <div className="mb-6 p-4 bg-gray-100 rounded-lg">
              <div className="flex items-center space-x-3 mb-3">
                {selectedInvitation.playlists?.cover && (
                  <img
                    src={selectedInvitation.playlists.cover}
                    alt={selectedInvitation.playlists.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                )}
                <div>
                  <h3 className="text-lg font-semibold text-black">
                    {selectedInvitation.playlists?.name || 'Playlist'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Invited by {selectedInvitation.inviter?.username || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => handleAcceptInvitation(selectedInvitation)}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center space-x-2"
              >
                <Check size={18} />
                <span>Accept</span>
              </button>
              <button
                onClick={() => handleDeclineInvitation(selectedInvitation.id)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center space-x-2"
              >
                <XCircle size={18} />
                <span>Decline</span>
              </button>
            </div>

            {/* Show other pending invitations if there are more */}
            {pendingInvitations.length > 1 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">
                  {pendingInvitations.length - 1} more invitation{pendingInvitations.length - 1 > 1 ? 's' : ''} pending
                </p>
                <button
                  onClick={() => {
                    const nextIndex = pendingInvitations.findIndex(inv => inv.id === selectedInvitation.id) + 1;
                    if (nextIndex < pendingInvitations.length) {
                      setSelectedInvitation(pendingInvitations[nextIndex]);
                    } else {
                      setSelectedInvitation(pendingInvitations[0]);
                    }
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  View Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Playlists; 