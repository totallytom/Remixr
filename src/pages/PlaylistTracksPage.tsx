import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { 
  Play, 
  Pause, 
  Shuffle, 
  Download, 
  UserPlus, 
  MoreHorizontal,
  Clock,
  List,
  Heart,
  Plus,
  X,
  Search,
  Check,
  XCircle,
  Users,
  UserMinus,
  Mail
} from 'lucide-react';
import { createDisplayName, createPlaylistDisplayName, useUUIDMasking } from '../utils/debugUtils';
import { MusicService } from '../services/musicService';
import { ChatService } from '../services/chatService';
import { supabase } from '../services/supabase';
import { getAvatarUrl } from '../utils/avatar';

const PlaylistTracksPage: React.FC = () => {
  const { playlistId } = useParams<{ playlistId: string }>();
  const { playlists, player, playTrack, playQueue, addToQueue, user, setPlaylists } = useStore();
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isChangingCover, setIsChangingCover] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddTrackModal, setShowAddTrackModal] = useState(false);
  const [availableTracks, setAvailableTracks] = useState<any[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  
  // Invitation states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  
  // Collaborators states
  const [showCollaboratorsSection, setShowCollaboratorsSection] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [pendingInvitesSent, setPendingInvitesSent] = useState<any[]>([]);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);

  const playlist = playlists.find((p) => p.id === playlistId);
  const isOwner = user && playlist && user.id === playlist.createdBy;

  // Check playlist access
  useEffect(() => {
    const checkAccess = async () => {
      if (!playlistId || !user) {
        setIsCheckingAccess(false);
        return;
      }
      
      setIsCheckingAccess(true);
      try {
        const access = await MusicService.hasPlaylistAccess(playlistId, user.id);
        setHasAccess(access);
      } catch (error) {
        console.error('Failed to check playlist access:', error);
        setHasAccess(false);
      } finally {
        setIsCheckingAccess(false);
      }
    };

    checkAccess();
  }, [playlistId, user]);

  // Load pending invitations (received by current user)
  useEffect(() => {
    const loadInvitations = async () => {
      if (!user || !playlistId) return;
      
      try {
        const invitations = await MusicService.getPlaylistInvitations(user.id, 'pending');
        setPendingInvitations(invitations.filter(inv => inv.playlists?.id === playlistId));
      } catch (error) {
        console.error('Failed to load invitations:', error);
      }
    };

    loadInvitations();
  }, [user, playlistId]);

  // Load collaborators and pending invitations sent (for owner)
  useEffect(() => {
    const loadCollaborators = async () => {
      if (!playlistId || !isOwner || !user) return;
      
      setIsLoadingCollaborators(true);
      try {
        const [collabs, pending] = await Promise.all([
          MusicService.getPlaylistCollaborators(playlistId),
          MusicService.getPlaylistPendingInvitations(playlistId, user.id)
        ]);
        setCollaborators(collabs);
        setPendingInvitesSent(pending);
      } catch (error) {
        console.error('Failed to load collaborators:', error);
      } finally {
        setIsLoadingCollaborators(false);
      }
    };

    loadCollaborators();
  }, [playlistId, isOwner, user]);

  // Fetch playlist data if not available in store
  useEffect(() => {
    const fetchPlaylist = async () => {
      if (!playlistId) return;
      
      // If playlist is not in store or has no tracks, fetch from database
      if (!playlist || playlist.tracks.length === 0) {
        setIsLoading(true);
        try {
          const fetchedPlaylist = await MusicService.getPlaylistById(playlistId);
          
          // Update store with fetched playlist
          if (playlist) {
            setPlaylists(playlists.map(p => p.id === playlistId ? fetchedPlaylist : p));
          } else {
            setPlaylists([...playlists, fetchedPlaylist]);
          }
        } catch (error) {
          console.error('Failed to fetch playlist:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    fetchPlaylist();
  }, [playlistId, playlist, playlists, setPlaylists]);

  const loadAvailableTracks = async () => {
    setIsLoadingTracks(true);
    try {
      const tracks = await MusicService.getTracks();
      setAvailableTracks(tracks);
    } catch (error) {
      console.error('Failed to load tracks:', error);
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const handleAddTrackToPlaylist = async (track: any) => {
    if (!playlist || !hasAccess) return;
    
    // Check for duplicates
    if (playlist.tracks.find(t => t.id === track.id)) {
      alert('This track is already in the playlist');
      return;
    }
    
    try {
      await MusicService.addTrackToPlaylist(playlist.id, track.id);
      
      // Refresh playlist
      const updatedPlaylist = await MusicService.getPlaylistById(playlist.id);
      setPlaylists(playlists.map(p => p.id === playlist.id ? updatedPlaylist : p));
      setShowAddTrackModal(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('duplicate key') || message.includes('unique constraint')) {
        alert('Duplicated tracks!!');
        setShowAddTrackModal(false);
      } else {
        console.error('Failed to add track to playlist:', error);
        alert(`Failed to add track to playlist: ${message}`);
      }
    }
  };

  const handleSearchUsers = async (query: string) => {
    if (!user || !query.trim()) {
      setInviteSearchResults([]);
      return;
    }
    
    setIsSearchingUsers(true);
    try {
      const results = await ChatService.searchUsers(query, user.id, 10);
      setInviteSearchResults(results);
    } catch (error) {
      console.error('Failed to search users:', error);
      setInviteSearchResults([]);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const handleInviteUser = async (inviteeId: string) => {
    if (!playlist || !user || !playlistId) return;
    
    try {
      await MusicService.inviteUserToPlaylist(playlistId, user.id, inviteeId);
      alert('Invitation sent successfully!');
      setInviteSearchQuery('');
      setInviteSearchResults([]);
      
      // Refresh collaborators list
      if (isOwner) {
        const [collabs, pending] = await Promise.all([
          MusicService.getPlaylistCollaborators(playlistId),
          MusicService.getPlaylistPendingInvitations(playlistId, user.id)
        ]);
        setCollaborators(collabs);
        setPendingInvitesSent(pending);
      }
    } catch (error) {
      console.error('Failed to send invitation:', error);
      alert(`Failed to send invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    if (!user) return;
    
    try {
      await MusicService.acceptPlaylistInvitation(invitationId, user.id);
      setHasAccess(true);
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      alert('Invitation accepted! You can now collaborate on this playlist.');
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      alert(`Failed to accept invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    if (!user) return;
    
    try {
      await MusicService.declinePlaylistInvitation(invitationId, user.id);
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      alert(`Failed to decline invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRemoveCollaborator = async (invitationId: string) => {
    if (!user || !isOwner || !playlistId) return;
    
    if (!confirm('Are you sure you want to remove this collaborator? They will lose access to this playlist.')) return;
    
    try {
      await MusicService.removeCollaborator(invitationId, user.id);
      
      // Refresh collaborators list
      const [collabs, pending] = await Promise.all([
        MusicService.getPlaylistCollaborators(playlistId),
        MusicService.getPlaylistPendingInvitations(playlistId, user.id)
      ]);
      setCollaborators(collabs);
      setPendingInvitesSent(pending);
      
      alert('Collaborator removed successfully');
    } catch (error) {
      console.error('Failed to remove collaborator:', error);
      alert(`Failed to remove collaborator: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!playlist || !hasAccess) return;

    try {
      await MusicService.removeTrackFromPlaylist(playlist.id, trackId);
      const updatedPlaylist = await MusicService.getPlaylistById(playlist.id);
      setPlaylists(playlists.map(p => p.id === playlist.id ? updatedPlaylist : p));
    } catch (error) {
      console.error('Failed to remove track:', error);
      alert(`Failed to remove track: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!user || !isOwner || !playlistId) return;
    
    try {
      await MusicService.cancelInvitation(invitationId, user.id);
      
      // Refresh pending invitations list
      const pending = await MusicService.getPlaylistPendingInvitations(playlistId, user.id);
      setPendingInvitesSent(pending);
      
      alert('Invitation cancelled successfully');
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      alert(`Failed to cancel invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if ((isLoading || isCheckingAccess) && !playlist) {
    return (
      <div className="min-h-screen bg-dark-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading playlist...</p>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Playlist Not Found</h2>
        <button
          className="px-4 py-2 bg-var(--color-warm) text-black rounded"
          onClick={() => navigate('/playlists')}
        >
          Back to Playlists
        </button>
      </div>
    );
  }

  if (!hasAccess && !isOwner) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
        <p className="text-gray-400 mb-4">You don't have access to this playlist.</p>
        {pendingInvitations.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-300">You have a pending invitation:</p>
            {pendingInvitations.map(invitation => (
              <div key={invitation.id} className="flex items-center justify-center space-x-4">
                <button
                  onClick={() => handleAcceptInvitation(invitation.id)}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDeclineInvitation(invitation.id)}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Decline
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          className="px-4 py-2 bg-var(--color-warm) text-black rounded mt-4"
          onClick={() => navigate('/playlists')}
        >
          Back to Playlists
        </button>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const handlePlayPlaylist = () => {
    if (playlist.tracks.length > 0) {
      playQueue(playlist.tracks);
      setIsPlaying(true);
    }
  };

  const handlePlayTrack = (track: any) => {
    playTrack(track);
    setIsPlaying(true);
  };

  const handleChangeCover = async (coverUrl: string) => {
    if (!user || !playlist) return;
    
    setIsChangingCover(true);
    try {
      await MusicService.updatePlaylist(playlist.id, user.id, { cover: coverUrl });
      setPlaylists(playlists.map(p => p.id === playlist.id ? { ...p, cover: coverUrl } : p));
      setShowCoverModal(false);
    } catch (error) {
      console.error('Failed to update playlist cover:', error);
      alert('Failed to update playlist cover. Please try again.');
    } finally {
      setIsChangingCover(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!user || !playlist) return;
    
    setIsChangingCover(true);
    try {
      // Upload file to Supabase storage
      const fileName = `playlist-covers/${playlist.id}-${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('music-files')
        .upload(fileName, file);

      if (uploadError) throw new Error(uploadError.message);

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('music-files')
        .getPublicUrl(fileName);

      const coverUrl = urlData.publicUrl;

      // Update playlist with new cover URL
      await MusicService.updatePlaylist(playlist.id, user.id, { cover: coverUrl });
      setPlaylists(playlists.map(p => p.id === playlist.id ? { ...p, cover: coverUrl } : p));
      setShowCoverModal(false);
    } catch (error) {
      console.error('Failed to upload playlist cover:', error);
      alert('Failed to upload playlist cover. Please try again.');
    } finally {
      setIsChangingCover(false);
    }
  };

  // Get the playlist cover or fallback to first track cover
  const playlistCover = playlist.cover || 
    (playlist.tracks.length > 0 ? playlist.tracks[0].cover : null) ||
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';

  return (
    <div className="min-h-screen bg-dark-900">

      {/* ── Hero Header ── */}
      <div className="relative bg-gradient-to-b from-violet-950/80 via-violet-900/30 to-dark-900">
        <div className="flex flex-col sm:flex-row sm:items-end gap-5 p-5 sm:p-8 pt-6 sm:pt-10">

          {/* Cover Art */}
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-xl overflow-hidden flex-shrink-0 mx-auto sm:mx-0 shadow-2xl bg-dark-700 group/cover">
            <img
              src={playlistCover}
              alt="Playlist Cover"
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.fallback-cover-playlist-page')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'fallback-cover-playlist-page w-full h-full flex items-center justify-center bg-dark-600 text-5xl';
                  fallback.textContent = '🎵';
                  parent.appendChild(fallback);
                }
              }}
              onLoad={(e) => {
                const target = e.target as HTMLImageElement;
                const fallback = target.parentElement?.querySelector('.fallback-cover-playlist-page');
                if (fallback) fallback.remove();
              }}
            />
            {user && playlist && user.id === playlist.createdBy && (
              <button
                onClick={() => setShowCoverModal(true)}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover/cover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white"
              >
                <Plus size={22} />
                <span className="text-xs font-medium">Change cover</span>
              </button>
            )}
          </div>

          {/* Playlist Info + Actions */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <p className="text-xs uppercase tracking-widest text-violet-400 font-semibold mb-1">Playlist</p>
            <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight break-words mb-2">
              {playlist.name}
            </h1>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-gray-400 mb-5 flex-wrap">
              <span>{playlist.tracks.length} {playlist.tracks.length === 1 ? 'track' : 'tracks'}</span>
              {!playlist.isPublic && (
                <span className="px-2 py-0.5 bg-violet-600/30 text-violet-300 rounded-full text-xs border border-violet-600/40">
                  Private
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center sm:justify-start flex-wrap gap-2">
              <button
                onClick={handlePlayPlaylist}
                disabled={playlist.tracks.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full font-semibold text-sm transition-colors"
              >
                <Play size={16} fill="currentColor" />
                Play
              </button>
              {hasAccess && (
                <button
                  onClick={() => { setShowAddTrackModal(true); loadAvailableTracks(); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-dark-700/80 hover:bg-dark-600 text-white rounded-full text-sm transition-colors border border-dark-500/60"
                >
                  <Plus size={15} />
                  Add tracks
                </button>
              )}
              {isOwner && (
                <>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-dark-700/80 hover:bg-dark-600 text-white rounded-full text-sm transition-colors border border-dark-500/60"
                  >
                    <UserPlus size={15} />
                    Invite
                  </button>
                  <button
                    onClick={() => setShowCollaboratorsSection(!showCollaboratorsSection)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm transition-colors border ${
                      showCollaboratorsSection
                        ? 'bg-violet-600/30 border-violet-500/50 text-violet-300'
                        : 'bg-dark-700/80 hover:bg-dark-600 text-white border-dark-500/60'
                    }`}
                  >
                    <Users size={15} />
                    {collaborators.length > 0
                      ? `${collaborators.length} collaborator${collaborators.length !== 1 ? 's' : ''}`
                      : 'Collaborators'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Pending Invitation Banner ── */}
      {pendingInvitations.length > 0 && !hasAccess && (
        <div className="mx-4 sm:mx-8 mb-2 mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 bg-blue-900/40 border border-blue-700/50 rounded-xl">
          <p className="text-sm text-white font-medium">You have a pending invitation to collaborate on this playlist.</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => handleAcceptInvitation(pendingInvitations[0].id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-400 text-white rounded-lg text-sm transition-colors"
            >
              <Check size={14} /> Accept
            </button>
            <button
              onClick={() => handleDeclineInvitation(pendingInvitations[0].id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg text-sm transition-colors"
            >
              <XCircle size={14} /> Decline
            </button>
          </div>
        </div>
      )}

      {/* ── Collaborators Panel ── */}
      {isOwner && showCollaboratorsSection && (
        <div className="mx-4 sm:mx-8 mb-4 mt-2 bg-dark-800/60 border border-dark-700/60 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-700/60">
            <p className="text-sm font-semibold text-black flex items-center gap-2">
              <Users size={16} className="text-violet-400" />
              Collaborators
            </p>
          </div>

          {isLoadingCollaborators ? (
            <div className="flex items-center justify-center py-8 gap-3 text-gray-400 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-violet-400" />
              Loading…
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Active */}
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-500 font-medium mb-2 flex items-center gap-1.5">
                  <Check size={12} className="text-green-400" />
                  Active · {collaborators.length}
                </p>
                {collaborators.length === 0 ? (
                  <p className="text-gray-500 text-sm py-2">No active collaborators yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {collaborators.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-dark-700/50 hover:bg-dark-700 rounded-lg transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={getAvatarUrl(c.avatar)} alt={c.username} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                          <span className="text-white text-sm font-medium truncate">{c.username}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveCollaborator(c.invitationId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs transition-colors flex-shrink-0"
                        >
                          <UserMinus size={12} /> Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending */}
              {pendingInvitesSent.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-500 font-medium mb-2 flex items-center gap-1.5">
                    <Mail size={12} className="text-yellow-400" />
                    Pending · {pendingInvitesSent.length}
                  </p>
                  <div className="space-y-1.5">
                    {pendingInvitesSent.map((inv) => (
                      <div key={inv.invitationId} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-dark-700/50 hover:bg-dark-700 rounded-lg transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={getAvatarUrl(inv.avatar)} alt={inv.username} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{inv.username}</p>
                            <p className="text-gray-500 text-xs">Invited {new Date(inv.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCancelInvitation(inv.invitationId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-600 hover:bg-dark-500 text-gray-400 rounded-lg text-xs transition-colors flex-shrink-0"
                        >
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Track List ── */}
      <div className="px-4 sm:px-8 pb-24">
        {/* Desktop column header */}
        <div className="hidden md:grid grid-cols-[40px_1fr_180px_120px_56px_40px] gap-4 px-3 py-2 mb-1 border-b border-dark-700/50">
          <div className="text-xs uppercase tracking-widest text-gray-600 text-center">#</div>
          <div className="text-xs uppercase tracking-widest text-gray-600">Title</div>
          <div className="text-xs uppercase tracking-widest text-gray-600">Album</div>
          <div className="text-xs uppercase tracking-widest text-gray-600">Date added</div>
          <div className="flex justify-end"><Clock size={13} className="text-gray-600" /></div>
          <div />
        </div>

        {playlist.tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 bg-dark-800 rounded-full flex items-center justify-center text-3xl">🎵</div>
            <p className="text-gray-400 text-sm">No tracks yet</p>
            {hasAccess && (
              <button
                onClick={() => { setShowAddTrackModal(true); loadAvailableTracks(); }}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-full text-sm transition-colors"
              >
                <Plus size={15} /> Add your first track
              </button>
            )}
          </div>
        ) : (
          <div>
            {playlist.tracks.map((track, index) => (
              <div
                key={createDisplayName(track.id)}
                onClick={() => handlePlayTrack(track)}
                className="group flex md:grid md:grid-cols-[40px_1fr_180px_120px_56px_40px] items-center gap-3 md:gap-4 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-white/5 mb-0.5"
              >
                {/* Index / play icon */}
                <div className="w-8 flex-shrink-0 flex items-center justify-center">
                  <span className="text-gray-500 text-sm group-hover:hidden select-none">{index + 1}</span>
                  <Play size={14} className="hidden group-hover:block text-white" fill="currentColor" />
                </div>

                {/* Cover + title/artist */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <img
                    src={track.cover}
                    alt={track.title}
                    className="w-10 h-10 rounded-md object-cover flex-shrink-0 bg-dark-700"
                  />
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate leading-snug">{track.title}</p>
                    <p className="text-gray-500 text-xs truncate">{track.artist}</p>
                  </div>
                </div>

                {/* Album — desktop */}
                <div className="hidden md:block text-gray-500 text-sm truncate">{track.album}</div>

                {/* Date — desktop */}
                <div className="hidden md:block text-gray-500 text-sm">{formatDate(new Date())}</div>

                {/* Duration */}
                <div className="flex-shrink-0 text-gray-500 text-sm md:text-right tabular-nums">
                  {formatDuration(track.duration)}
                </div>

                {/* Remove button */}
                {hasAccess && (
                  <div className="flex justify-end flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveTrack(track.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      title="Remove from playlist"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Track Modal ── */}
      {showAddTrackModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-dark-800 border border-dark-700/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700/60 flex-shrink-0">
              <p className="text-base font-semibold text-black">Add to "{playlist?.name}"</p>
              <button onClick={() => setShowAddTrackModal(false)} className="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-dark-700">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {isLoadingTracks ? (
                <div className="flex items-center justify-center py-12 gap-3 text-gray-400 text-sm">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-violet-400" />
                  Loading tracks…
                </div>
              ) : (
                <>
                  {availableTracks.filter(t => !playlist?.tracks.find(pt => pt.id === t.id)).length === 0 ? (
                    <p className="text-center text-gray-500 text-sm py-12">No tracks available to add.</p>
                  ) : (
                    <div className="space-y-1">
                      {availableTracks
                        .filter(t => !playlist?.tracks.find(pt => pt.id === t.id))
                        .map((track) => (
                          <div key={track.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-700/60 transition-colors group/row">
                            <img src={track.cover} alt={track.title} className="w-10 h-10 rounded-md object-cover flex-shrink-0 bg-dark-700" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{track.title}</p>
                              <p className="text-gray-500 text-xs truncate">{track.artist}</p>
                            </div>
                            <span className="text-gray-600 text-xs tabular-nums mr-1">{formatDuration(track.duration)}</span>
                            <button
                              onClick={() => handleAddTrackToPlaylist(track)}
                              className="p-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-full transition-colors flex-shrink-0"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </>
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

      {/* ── Cover Change Modal ── */}
      {showCoverModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-dark-800 border border-dark-700/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700/60">
              <h2 className="text-base font-semibold text-white">Change cover</h2>
              <button onClick={() => setShowCoverModal(false)} className="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-dark-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* Upload */}
              <div>
                <p className="text-xs font-medium text-gray-400 mb-2">Upload image</p>
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                    isDragOver ? 'border-violet-500 bg-violet-500/10' : 'border-dark-600 hover:border-violet-600/60'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                  onDrop={(e) => {
                    e.preventDefault(); setIsDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file?.type.startsWith('image/')) handleFileUpload(file);
                  }}
                >
                  <input type="file" accept="image/*" id="coverFile" className="hidden" disabled={isChangingCover}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                  />
                  <label htmlFor="coverFile" className="cursor-pointer flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-dark-700 rounded-full flex items-center justify-center">
                      <Plus size={20} className="text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-300">
                      {isChangingCover ? 'Uploading…' : isDragOver ? 'Drop here' : 'Click or drag image'}
                    </p>
                    <p className="text-xs text-gray-600">PNG, JPG up to 5MB</p>
                  </label>
                </div>
              </div>

              {/* URL */}
              <div>
                <p className="text-xs font-medium text-gray-400 mb-2">Or paste URL</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    id="coverUrl"
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <button
                    onClick={() => {
                      const url = (document.getElementById('coverUrl') as HTMLInputElement)?.value;
                      if (url) handleChangeCover(url);
                    }}
                    disabled={isChangingCover}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg text-sm transition-colors"
                  >
                    {isChangingCover ? '…' : 'Apply'}
                  </button>
                </div>
              </div>

              {/* Track covers */}
              {playlist.tracks.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-2">Use a track cover</p>
                  <div className="grid grid-cols-5 gap-2">
                    {playlist.tracks.slice(0, 10).map((track, i) => (
                      <button
                        key={track.id}
                        onClick={() => handleChangeCover(track.cover)}
                        disabled={isChangingCover}
                        className="aspect-square rounded-lg overflow-hidden hover:opacity-75 transition-opacity disabled:opacity-40"
                      >
                        <img src={track.cover} alt={`Track ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Modal ── */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-dark-800 border border-dark-700/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700/60">
              <p className="text-base font-semibold text-black">Invite collaborators</p>
              <button
                onClick={() => { setShowInviteModal(false); setInviteSearchQuery(''); setInviteSearchResults([]); }}
                className="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-dark-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="text"
                  placeholder="Search by username…"
                  value={inviteSearchQuery}
                  onChange={(e) => { setInviteSearchQuery(e.target.value); handleSearchUsers(e.target.value); }}
                  className="w-full pl-9 pr-4 py-2.5 bg-dark-700 border border-dark-600 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {isSearchingUsers ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-violet-400" /> Searching…
                  </div>
                ) : inviteSearchResults.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm py-8">
                    {inviteSearchQuery ? 'No users found' : 'Search for users to invite'}
                  </p>
                ) : (
                  inviteSearchResults.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-700/60 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={getAvatarUrl(u.avatar)} alt={u.username} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{u.username}</p>
                          {u.artistName && <p className="text-gray-500 text-xs truncate">{u.artistName}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleInviteUser(u.id)}
                        className="flex-shrink-0 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-full text-xs font-medium transition-colors"
                      >
                        Invite
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PlaylistTracksPage; 