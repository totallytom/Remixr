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
  Share2,
  Lock,
  UserPlus,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import PlaylistCard from '../components/music/PlaylistCard';
import { Playlist, Track } from '../store/useStore';
import { MusicService } from '../services/musicService';
import { supabase } from '../services/supabase';
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

  // Guest (unauthenticated) public playlists
  const [guestPlaylists, setGuestPlaylists] = useState<any[]>([]);
  const [isLoadingGuest, setIsLoadingGuest] = useState(false);

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

  // Load public playlists for guest (unauthenticated) users
  useEffect(() => {
    if (user) return;
    setIsLoadingGuest(true);
    supabase
      .from('playlists')
      .select('id, name, description, cover, is_public')
      .eq('is_public', true)
      .limit(16)
      .then(({ data }) => { setGuestPlaylists(data || []); setIsLoadingGuest(false); })
      .catch(() => setIsLoadingGuest(false));
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

  if (isLoading || (!user && isLoadingGuest)) {
    return (
      <div className="py-20 flex items-center flex-col gap-4 justify-center">
        <div className="spinner w-8 h-8"></div>
        <span className="ml-2 text-gray-500">Loading playlists...</span>
      </div>
    );
  }

  // Guest view — show public playlists with a sign-up CTA
  if (!user) {
    return (
      <div className="flex flex-col h-full bg-dark-900">
        {/* Sign-up banner */}
        <div className="flex-shrink-0 mx-5 sm:mx-8 mt-6 mb-2 flex items-center justify-between gap-3 px-4 py-3 bg-primary-900/30 border border-primary-700/40 rounded-xl">
          <div className="min-w-0">
            <p className="text-white text-sm font-medium">Explore public playlists</p>
            <p className="text-primary-300 text-xs truncate">Sign up to create and manage your own collections</p>
          </div>
          <button
            onClick={() => navigate('/signup')}
            className="flex-shrink-0 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-full text-sm font-medium transition-colors"
          >
            Sign Up Free
          </button>
        </div>

        {/* Header */}
        <div className="flex-shrink-0 px-5 sm:px-8 pt-4 pb-4">
          <p className="text-2xl sm:text-3xl font-bold text-white font-kyobo leading-tight">Public Playlists</p>
          <p className="text-white text-sm mt-0.5">Music collections shared by the community</p>
        </div>

        {/* Playlist grid */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 pb-[132px] lg:pb-6 scrollbar-hide">
          {guestPlaylists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 bg-dark-800 rounded-full flex items-center justify-center">
                <ListMusic size={28} className="text-gray-600" />
              </div>
              <div className="text-center">
                <p className="text-white font-medium">No public playlists yet</p>
                <p className="text-gray-500 text-sm">Be the first to create and share a playlist!</p>
              </div>
              <button
                onClick={() => navigate('/signup')}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-full text-sm font-semibold transition-colors"
              >
                <UserPlus size={16} /> Create Account
              </button>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              {guestPlaylists.map((playlist, index) => (
                <motion.div
                  key={playlist.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => navigate('/signup')}
                  className="cursor-pointer flex items-center gap-4 p-4 bg-dark-800 rounded-xl hover:bg-dark-700 transition-colors border border-dark-700/60"
                >
                  {playlist.cover ? (
                    <img src={playlist.cover} alt={playlist.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-dark-700 flex items-center justify-center flex-shrink-0">
                      <ListMusic size={22} className="text-gray-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-black font-medium truncate">{playlist.name}</p>
                    {playlist.description && (
                      <p className="text-black text-sm truncate">{playlist.description}</p>
                    )}
                  </div>
                  <Lock size={15} className="text-gray-600 flex-shrink-0" />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-dark-900">

      {/* ── Static Header ── */}
      <div className="flex-shrink-0 px-5 sm:px-8 pt-6 pb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-2xl sm:text-3xl font-bold text-white font-kyobo leading-tight">My Playlists</p>
          <p className="text-gray-500 text-sm mt-0.5">Organize and enjoy your music collections</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-full text-sm font-semibold transition-colors flex-shrink-0"
        >
          <PlusCircle size={16} />
          <span className="hidden sm:inline">Create Playlist</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* ── Static Search + View Toggle ── */}
      <div className="flex-shrink-0 px-5 sm:px-8 pb-4 flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            placeholder="Search playlists…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-dark-800 border border-dark-700/60 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div className="flex items-center gap-1 bg-dark-800 border border-dark-700/60 rounded-xl p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            <Grid size={16} />
          </button>
        </div>
      </div>

      {/* ── Static Pending Invitations Banner ── */}
      {pendingInvitations.length > 0 && (
        <div className="flex-shrink-0 mx-5 sm:mx-8 mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-blue-900/40 border border-blue-700/50 rounded-xl">
          <div className="flex items-center gap-3 min-w-0">
            <Mail size={18} className="text-blue-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {pendingInvitations.length} pending invitation{pendingInvitations.length > 1 ? 's' : ''}
              </p>
              <p className="text-blue-300 text-xs">Tap to view and respond</p>
            </div>
          </div>
          <button
            onClick={() => { setSelectedInvitation(pendingInvitations[0]); setShowInvitationModal(true); }}
            className="flex-shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-xs font-medium transition-colors"
          >
            View
          </button>
        </div>
      )}

      {/* ── Scrollable Playlist List ── */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 pb-[132px] lg:pb-6 scrollbar-hide">
        {filteredPlaylists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 bg-dark-800 rounded-full flex items-center justify-center">
              <ListMusic size={28} className="text-gray-600" />
            </div>
            <div className="text-center">
              <p className="text-white font-medium mb-1">No playlists yet</p>
              <p className="text-gray-500 text-sm">Create your first playlist to get started</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-full text-sm font-semibold transition-colors"
            >
              <PlusCircle size={16} /> Create Playlist
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            {filteredPlaylists.map((playlist, index) => {
              const isShared = (playlist as any).isShared || safeSharedPlaylists.some(sp => sp.id === playlist.id);
              const isOwner = user && playlist.createdBy === user.id;
              return (
                <motion.div
                  key={playlist.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handlePlaylistClick(playlist)}
                  className="cursor-pointer relative"
                >
                  {isShared && !isOwner && (
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 bg-blue-600/80 text-white rounded-full text-xs font-semibold">
                      <Share2 size={10} />
                      <span>Shared</span>
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
                    showActions={!!isOwner}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* ── Create Playlist Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-dark-800 border border-dark-700/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl mb-[136px] sm:mb-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700/60">
              <p className="text-base font-semibold text-black">New Playlist</p>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-dark-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1.5">Name</p>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                  className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="My awesome playlist"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm text-white font-medium">Public playlist</p>
                  <p className="text-xs text-gray-500">Anyone can find and listen</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={createForm.isPublic}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                    id="isPublic"
                  />
                  <div className="w-10 h-6 bg-dark-600 peer-focus:ring-2 peer-focus:ring-violet-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600" />
                </label>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={handleCreatePlaylist}
                disabled={isCreating || !createForm.name.trim()}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {isCreating ? 'Creating…' : 'Create'}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Track Modal ── */}
      {showAddTrackModal && selectedPlaylist && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-dark-800 border border-dark-700/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700/60 flex-shrink-0">
              <p className="text-base font-semibold text-black">Add to "{selectedPlaylist.name}"</p>
              <button onClick={() => setShowAddTrackModal(false)} className="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-dark-700">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {availableTracks.filter(t => !selectedPlaylist.tracks.find(pt => pt.id === t.id)).length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-12">No tracks available to add.</p>
              ) : (
                <div className="space-y-1">
                  {availableTracks
                    .filter(t => !selectedPlaylist.tracks.find(pt => pt.id === t.id))
                    .map((track) => (
                      <div key={track.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-700/60 transition-colors">
                        <img src={track.cover} alt={track.title} className="w-10 h-10 rounded-md object-cover flex-shrink-0 bg-dark-700" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{track.title}</p>
                          <p className="text-gray-500 text-xs truncate">{track.artist}</p>
                        </div>
                        <span className="text-gray-600 text-xs tabular-nums mr-1">{formatDuration(track.duration)}</span>
                        <button
                          onClick={() => handleAddTrackToPlaylist(selectedPlaylist.id, track)}
                          className="p-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-full transition-colors flex-shrink-0"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-dark-700/60 flex-shrink-0">
              <button onClick={() => setShowAddTrackModal(false)} className="w-full py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-xl text-sm transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invitation Modal ── */}
      {showInvitationModal && selectedInvitation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-dark-800 border border-dark-700/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700/60">
              <p className="text-base font-semibold text-black">Playlist Invitation</p>
              <button
                onClick={() => { setShowInvitationModal(false); setSelectedInvitation(null); }}
                className="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-dark-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-gray-400 text-sm mb-4">You've been invited to collaborate on a playlist.</p>
              <div className="flex items-center gap-4 p-4 bg-dark-700/60 rounded-xl mb-5">
                {selectedInvitation.playlists?.cover && (
                  <img
                    src={selectedInvitation.playlists.cover}
                    alt={selectedInvitation.playlists.name}
                    className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{selectedInvitation.playlists?.name || 'Playlist'}</p>
                  <p className="text-gray-400 text-sm truncate">
                    Invited by {selectedInvitation.inviter?.username || 'Unknown'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => handleAcceptInvitation(selectedInvitation)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-400 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  <Check size={16} /> Accept
                </button>
                <button
                  onClick={() => handleDeclineInvitation(selectedInvitation.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-xl text-sm transition-colors"
                >
                  <XCircle size={16} /> Decline
                </button>
              </div>
              {pendingInvitations.length > 1 && (
                <div className="pt-3 border-t border-dark-700/60 flex items-center justify-between">
                  <p className="text-gray-500 text-xs">
                    {pendingInvitations.length - 1} more invitation{pendingInvitations.length - 1 > 1 ? 's' : ''} pending
                  </p>
                  <button
                    onClick={() => {
                      const nextIndex = pendingInvitations.findIndex(inv => inv.id === selectedInvitation.id) + 1;
                      setSelectedInvitation(pendingInvitations[nextIndex < pendingInvitations.length ? nextIndex : 0]);
                    }}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Playlists; 