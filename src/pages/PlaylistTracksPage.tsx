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
  const { playlists, player, playTrack, playQueue, addToQueue, user, updatePlaylist, setPlaylists, addTrackToPlaylist } = useStore();
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
            // Update existing playlist in store
            updatePlaylist(playlistId, fetchedPlaylist);
          } else {
            // Add new playlist to store
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
  }, [playlistId, playlist, playlists, updatePlaylist, setPlaylists]);

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
      if (playlist) {
        updatePlaylist(playlist.id, updatedPlaylist);
      } else {
        setPlaylists([...playlists, updatedPlaylist]);
      }
      
      setShowAddTrackModal(false);
    } catch (error) {
      console.error('Failed to add track to playlist:', error);
      alert(`Failed to add track to playlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      <div className="min-h-screen bg-dark-900 text-black flex items-center justify-center">
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
      
      // Update local state
      updatePlaylist(playlist.id, { cover: coverUrl });
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
      
      // Update local state
      updatePlaylist(playlist.id, { cover: coverUrl });
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
    <div className="min-h-screen bg-dark-900 text-black">
      {/* Header Section - playlist color on mobile */}
      <div className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-violet-900/50 to-indigo-900/40 md:bg-dark-800 border-b border-violet-700/50 md:border-dark-700">
        <div className="flex items-end space-x-4 md:space-x-6">
          {/* Playlist Cover Art */}
          <div className="relative w-48 h-48 rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
            <img 
              src={playlistCover} 
              alt="Playlist Cover"
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error('Failed to load cover image:', playlistCover);
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.fallback-cover-playlist-page')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'fallback-cover-playlist-page w-full h-full flex items-center justify-center bg-gray-300 text-6xl';
                  fallback.textContent = '🎵';
                  parent.appendChild(fallback);
                }
              }}
              onLoad={(e) => {
                // Hide fallback if image loads successfully
                const target = e.target as HTMLImageElement;
                const parent = target.parentElement;
                const fallback = parent?.querySelector('.fallback-cover-playlist-page');
                if (fallback) {
                  fallback.remove();
                }
              }}
            />
            
            {/* Cover Change Button */}
            {user && playlist && user.id === playlist.createdBy && (
              <button
                onClick={() => setShowCoverModal(true)}
                className="absolute inset-0 bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-black"
                title="Change playlist cover"
              >
                <div className="text-center">
                  <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Plus size={20} />
                  </div>
                  <span className="text-sm font-medium">Change Cover</span>
                </div>
              </button>
            )}
          </div>
          
          {/* Playlist Info */}
          <div className="flex-1">
            <div className="flex items-center mb-4">
              <p className="text-6xl font-bold text-black mr-4">
                {playlist.name}
              </p>
              <span className="ml-2 px-3 py-1 bg-dark-700 text-green-400 text-lg font-bold rounded-full align-middle" title="Number of tracks">
                {playlist.tracks.length} {playlist.tracks.length === 1 ? 'track' : 'tracks'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="px-8 py-4 bg-dark-900 border-b border-dark-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePlayPlaylist}
              className="w-14 h-14 bg-blue-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-colors"
            >
              <Play size={24} className="text-black ml-1" />
            </button>
            {isOwner && (
              <>
                <button 
                  onClick={() => setShowInviteModal(true)}
                  className="text-gray-400 hover:text-black transition-colors"
                  title="Invite users to collaborate"
                >
                  <UserPlus size={20} />
                </button>
                <button
                  onClick={() => setShowCollaboratorsSection(!showCollaboratorsSection)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  title="View collaborators"
                >
                  <Users size={18} />
                  <span>Collaborators</span>
                </button>
              </>
            )}
            {hasAccess && (
              <button
                onClick={() => {
                  setShowAddTrackModal(true);
                  loadAvailableTracks();
                }}
                className="px-4 py-2 bg-green-500 text-black rounded hover:bg-green-600 transition-colors flex items-center space-x-2"
                title="Add tracks to playlist"
              >
                <Plus size={18} />
                <span>Add Tracks</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Collaborators Section */}
      {isOwner && showCollaboratorsSection && (
        <div className="px-8 py-4 bg-dark-800 border-b border-dark-700">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Users size={20} />
              <span>Collaborators</span>
            </h3>
          </div>

          {isLoadingCollaborators ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto"></div>
              <p className="text-gray-400 mt-2">Loading collaborators...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Collaborators */}
              <div>
                <h4 className="text-md font-semibold text-white mb-3 flex items-center space-x-2">
                  <Check size={16} className="text-green-400" />
                  <span>Active Collaborators ({collaborators.length})</span>
                </h4>
                {collaborators.length === 0 ? (
                  <p className="text-gray-400 text-sm">No active collaborators yet.</p>
                ) : (
                  <div className="space-y-2">
                    {collaborators.map((collaborator) => (
                      <div
                        key={collaborator.id}
                        className="flex items-center justify-between p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <img
                            src={getAvatarUrl(collaborator.avatar)}
                            alt={collaborator.username}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-white font-medium">{collaborator.username}</p>
                            <p className="text-gray-400 text-sm">Active collaborator</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveCollaborator(collaborator.invitationId)}
                          className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex items-center space-x-2 text-sm"
                          title="Remove collaborator"
                        >
                          <UserMinus size={14} />
                          <span>Remove</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Invitations */}
              <div>
                <h4 className="text-md font-semibold text-white mb-3 flex items-center space-x-2">
                  <Mail size={16} className="text-yellow-400" />
                  <span>Pending Invitations ({pendingInvitesSent.length})</span>
                </h4>
                {pendingInvitesSent.length === 0 ? (
                  <p className="text-gray-400 text-sm">No pending invitations.</p>
                ) : (
                  <div className="space-y-2">
                    {pendingInvitesSent.map((invitation) => (
                      <div
                        key={invitation.invitationId}
                        className="flex items-center justify-between p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <img
                            src={getAvatarUrl(invitation.avatar)}
                            alt={invitation.username}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-white font-medium">{invitation.username}</p>
                            <p className="text-gray-400 text-sm">
                              Invited {new Date(invitation.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCancelInvitation(invitation.invitationId)}
                          className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center space-x-2 text-sm"
                          title="Cancel invitation"
                        >
                          <X size={14} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Track List - tracks use neutral/different color on mobile */}
      <div className="px-4 sm:px-6 md:px-8">
        {/* Table Header - hidden on mobile, track rows get left border instead */}
        <div className="hidden md:grid grid-cols-[50px_1fr_1fr_1fr_100px] gap-4 py-4 border-b border-dark-700 text-gray-400 text-sm font-medium">
          <div>#</div>
          <div>Title</div>
          <div>Album</div>
          <div>Date added</div>
          <div className="flex justify-center">
            <Clock size={16} />
          </div>
        </div>

        {/* Track Rows - color-coded as tracks on mobile (left border) */}
      {playlist.tracks.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            No tracks in this playlist yet.
            {hasAccess && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    setShowAddTrackModal(true);
                    loadAvailableTracks();
                  }}
                  className="px-4 py-2 bg-green-500 text-black rounded hover:bg-green-600 transition-colors"
                >
                  Add your first track
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {playlist.tracks.map((track, index) => (
              <div 
                key={createDisplayName(track.id)}
                className="grid grid-cols-[50px_1fr_1fr_1fr_100px] gap-4 py-3 hover:bg-dark-800 rounded group cursor-pointer transition-colors
                  md:border-l-0 border-l-4 border-l-emerald-500/70 bg-dark-800/50 md:bg-transparent"
                onClick={() => handlePlayTrack(track)}
              >
                <div className="flex items-center justify-center">
                  <span className="text-gray-400 group-hover:hidden">{index + 1}</span>
                  <button className="hidden group-hover:block text-black">
                    <Play size={16} />
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
                    <div className="text-black font-medium">{track.title}</div>
                    <div className="text-gray-400 text-sm">{track.artist}</div>
                  </div>
                </div>
                
                <div className="hidden md:flex items-center text-gray-400">
                  {track.album}
                </div>

                <div className="hidden md:flex items-center text-gray-400">
                  {formatDate(new Date())}
                </div>
                
                <div className="flex items-center justify-center text-gray-400">
                  {formatDuration(track.duration)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Track Modal */}
      {showAddTrackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xl font-bold text-black">
                Add Tracks to "{playlist?.name}"
              </div>
              <button
                onClick={() => setShowAddTrackModal(false)}
                className="p-2 text-gray-400 hover:text-black transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {isLoadingTracks ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading tracks...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableTracks
                    .filter(track => !playlist?.tracks.find(t => t.id === track.id))
                    .map((track) => (
                      <div key={track.id} className="flex items-center space-x-3 p-3 bg-dark-700 rounded hover:bg-dark-600 transition-colors">
                        <img
                          src={track.cover}
                          alt={track.title}
                          className="w-12 h-12 rounded object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-black truncate">{track.title}</p>
                          <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-400">{formatDuration(track.duration)}</span>
                          <button
                            onClick={() => handleAddTrackToPlaylist(track)}
                            className="p-2 bg-green-500 text-black rounded-full hover:bg-green-600 transition-colors"
                            title="Add to playlist"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  {availableTracks.filter(track => !playlist?.tracks.find(t => t.id === track.id)).length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <p>No tracks available to add to this playlist.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-dark-600">
              <button
                onClick={() => setShowAddTrackModal(false)}
                className="w-full bg-dark-700 text-black px-4 py-2 rounded-lg hover:bg-dark-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cover Change Modal */}
      {showCoverModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xl font-bold text-black">Change Playlist Cover</div>
              <button
                onClick={() => setShowCoverModal(false)}
                className="text-gray-400 hover:text-black transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
        <div className="space-y-4">
              {/* File Upload Section */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Upload Cover Image
                </label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragOver 
                      ? 'border-primary-500 bg-primary-500 bg-opacity-10' 
                      : 'border-dark-600 hover:border-primary-500'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                      handleFileUpload(file);
                    }
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload(file);
                      }
                    }}
                    className="hidden"
                    id="coverFile"
                    disabled={isChangingCover}
                  />
                  <label
                    htmlFor="coverFile"
                    className="cursor-pointer block"
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <div className="w-12 h-12 bg-dark-700 rounded-full flex items-center justify-center">
                        <Plus size={24} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-black">
                          {isChangingCover ? 'Uploading...' : isDragOver ? 'Drop image here' : 'Click to upload image'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          PNG, JPG, GIF up to 5MB
                        </p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* URL Input Section */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Or enter image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  id="coverUrl"
                />
              </div>
              
              {/* Preset Cover Options */}
              {playlist.tracks.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Use Track Cover
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {playlist.tracks.slice(0, 8).map((track, index) => (
                      <button
                        key={track.id}
                        onClick={() => handleChangeCover(track.cover)}
                        disabled={isChangingCover}
                        className="w-16 h-16 rounded-lg overflow-hidden hover:opacity-80 transition-opacity disabled:opacity-50"
                      >
                        <img 
                          src={track.cover} 
                          alt={`Track ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    const url = (document.getElementById('coverUrl') as HTMLInputElement)?.value;
                    if (url) {
                      handleChangeCover(url);
                    }
                  }}
                  disabled={isChangingCover}
                  className="flex-1 px-4 py-2 bg-primary-600 text-black rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isChangingCover ? 'Updating...' : 'Update from URL'}
                </button>
                <button
                  onClick={() => setShowCoverModal(false)}
                  className="px-4 py-2 bg-gray-600 text-black rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-black">Invite Users to Playlist</h2>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteSearchQuery('');
                  setInviteSearchResults([]);
                }}
                className="text-gray-400 hover:text-black transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search users by username..."
                  value={inviteSearchQuery}
                  onChange={(e) => {
                    setInviteSearchQuery(e.target.value);
                    handleSearchUsers(e.target.value);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            
            <div className="max-h-80 overflow-y-auto space-y-2">
              {isSearchingUsers ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto"></div>
                  <p className="text-gray-400 mt-2">Searching...</p>
                </div>
              ) : inviteSearchResults.length === 0 && inviteSearchQuery ? (
                <p className="text-center text-gray-400 py-4">No users found</p>
              ) : inviteSearchResults.length === 0 ? (
                <p className="text-center text-gray-400 py-4">Search for users to invite</p>
              ) : (
                inviteSearchResults.map((userResult) => (
                  <div
                    key={userResult.id}
                    className="flex items-center justify-between p-3 bg-dark-700 rounded hover:bg-dark-600 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={getAvatarUrl(userResult.avatar)}
                        alt={userResult.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-black font-medium">{userResult.username}</p>
                        {userResult.artistName && (
                          <p className="text-sm text-gray-400">{userResult.artistName}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleInviteUser(userResult.id)}
                      className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors text-sm"
                    >
                      Invite
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pending Invitation Banner */}
      {pendingInvitations.length > 0 && !hasAccess && (
        <div className="px-8 py-4 bg-blue-900 border-b border-blue-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">You have a pending invitation to collaborate on this playlist</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleAcceptInvitation(pendingInvitations[0].id)}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center space-x-2"
              >
                <Check size={16} />
                <span>Accept</span>
              </button>
              <button
                onClick={() => handleDeclineInvitation(pendingInvitations[0].id)}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex items-center space-x-2"
              >
                <XCircle size={16} />
                <span>Decline</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaylistTracksPage; 