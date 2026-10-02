import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  MoreVertical,
  Music,
  X,
  MessageCircle,
  Plus,
  Bookmark,
  ThumbsUp,
  List,
  Check,
  Flag,
  Share2,
  Download,
  Settings2,
  Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DownloadDialog from './DownloadDialog';
import RemixCredits from '../remix/RemixCredits';
import { remixAccess } from '../../services/remixService';
import LicenseBadge from './LicenseBadge';
import { useStore } from '../../store/useStore';
import { Track } from '../../store/useStore';
import { MusicService } from '../../services/musicService';
import { ChatService } from '../../services/chatService';
import { supabase } from '../../services/supabase';
import { createPortal } from 'react-dom';
import { getAvatarUrl } from '../../utils/avatar';
import VerifiedBadge from '../VerifiedBadge';

/** Fallback when a track has no cover (e.g. older uploads or upload path that didn't set cover). */
const DEFAULT_TRACK_COVER = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';

/** Hard "brutalist" offset shadow used throughout — matches the Re-Mixed mobile card design. */
const HARD_SHADOW = '4px 4px 0 0 #000';

const REPORT_REASONS: { key: string; label: string }[] = [
  { key: 'copyright', label: 'Copyright infringement' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'spam', label: 'Spam or misleading' },
  { key: 'other', label: 'Other' },
];

interface TrackCardProps {
  track: Track;
  onPlay?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  isPlaying?: boolean;
  showActions?: boolean;
  /** Compact vertical card for search grid: square image, minimal text */
  compactGrid?: boolean;
  onDelete?: (track: Track) => void;
}

const TrackCard: React.FC<TrackCardProps> = ({
  track,
  onPlay,
  onAddToQueue,
  isPlaying = false,
  showActions = true,
  compactGrid = false,
  onDelete
}) => {
  const {
    player,
    playTrack,
    addToQueue,
    playlists,
    setPlaylists,
    user,
    isAuthenticated
  } = useStore();

  const [showMenu, setShowMenu] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  // Own track: owner id from the track row, or (older queries without user_id)
  // the delete action, which is only passed for the user's own tracks.
  const isOwnTrack = Boolean(onDelete) || (!!user && (track as { userId?: string }).userId === user.id);
  const downloadDialog = showDownload && (
    <DownloadDialog trackId={track.id} trackTitle={track.title} onClose={() => setShowDownload(false)} />
  );

  // Remix: hidden only when we know the artist hasn't allowed it.
  const navigate = useNavigate();
  const [showCredits, setShowCredits] = useState(false);
  const canRemix = remixAccess(track as { userId?: string; licenseType?: string; allowRemix?: boolean }, user?.id) !== 'blocked';
  const isRemix = Boolean((track as { remixParentId?: string }).remixParentId);
  const goRemix = () => navigate(`/remix/${track.id}`);
  const creditsDialog = showCredits && (
    <RemixCredits trackId={track.id} trackTitle={track.title} onClose={() => setShowCredits(false)} />
  );
  const remixChip = isRemix && (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setShowCredits(true); }}
      className="inline-flex items-center gap-1 px-1.5 py-px rounded border border-black bg-violet-200 text-[10px] font-bold uppercase tracking-wide text-black hover:bg-violet-300"
      title="Remix — see credits"
    >
      <Layers size={10} /> Remix
    </button>
  );
  const [isLiked, setIsLiked] = useState(false);
  const [showMessageModalSentId, setShowMessageModalSentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [likesCount, setLikesCount] = useState(0);
  const [isLikedByUser, setIsLikedByUser] = useState(false);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);

  // Report state
  const [reportReason, setReportReason] = useState('copyright');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  // Create playlist state
  const [showCreatePlaylistForm, setShowCreatePlaylistForm] = useState(false);
  const [createPlaylistForm, setCreatePlaylistForm] = useState({
    name: '',
    isPublic: true
  });
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

  // Check if track is bookmarked on mount
  useEffect(() => {
    const checkBookmarkStatus = async () => {
      if (!user || !track) return;
      try {
        const bookmarked = await MusicService.isTrackBookmarked(track.id, user.id);
        setIsLiked(bookmarked);
      } catch (error) {
        console.error('Failed to check bookmark status:', error);
      }
    };

    checkBookmarkStatus();
  }, [user, track]);

  // Load track likes on mount
  useEffect(() => {
    const loadTrackLikes = async () => {
      if (!track) return;

      setIsLoadingLikes(true);
      try {
        const { likes, likedBy } = await MusicService.getTrackLikes(track.id);
        setLikesCount(likes);
        if (user) {
          setIsLikedByUser(likedBy.includes(user.id));
        }
      } catch (error) {
        console.error('Failed to load track likes:', error);
        // If the error is because likes column doesn't exist, just set defaults
        setLikesCount(0);
        setIsLikedByUser(false);
      } finally {
        setIsLoadingLikes(false);
      }
    };

    loadTrackLikes();
  }, [track, user]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isCurrentlyPlaying = player.currentTrack?.id === track.id && player.isPlaying;

  const handlePlayPause = () => {
    if (isCurrentlyPlaying) {
      player.audioElement?.pause();
      // Immediately update isPlaying in the store for instant UI feedback
      player.isPlaying = false;
    } else {
      if (onPlay) {
        onPlay(track);
      } else {
        playTrack(track);
      }
    }
  };

  const handleAddToQueue = () => {
    if (onAddToQueue) {
      onAddToQueue(track);
    } else {
      addToQueue(track);
    }
  };

  const handleLike = async () => {
    if (!user) return;

    try {
      if (isLiked) {
        // Remove bookmark
        await MusicService.removeBookmark(track.id, user.id);
        setIsLiked(false);
      } else {
        // Add bookmark
        await MusicService.addBookmark(track.id, user.id);
        setIsLiked(true);
      }
      // Dispatch event to notify other components (like Profile page) that bookmarks changed
      window.dispatchEvent(new CustomEvent('bookmarkChanged', {
        detail: { trackId: track.id, userId: user.id, bookmarked: !isLiked }
      }));
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
      // Revert state on error
      setIsLiked(!isLiked);
    }
  };

  const handleTrackLike = async () => {
    if (!user) return;

    // Optimistic update
    const previousLikesCount = likesCount;
    const previousIsLiked = isLikedByUser;

    if (isLikedByUser) {
      setLikesCount((prev: number) => Math.max(0, prev - 1));
      setIsLikedByUser(false);
    } else {
      setLikesCount((prev: number) => prev + 1);
      setIsLikedByUser(true);
    }

    try {
      await MusicService.likeTrack(track.id, user.id);
      // Reload to get accurate count
      const { likes, likedBy } = await MusicService.getTrackLikes(track.id);
      setLikesCount(likes);
      setIsLikedByUser(likedBy.includes(user.id));
      window.dispatchEvent(new CustomEvent('likedChanged', { detail: { trackId: track.id, userId: user.id } }));
    } catch (error) {
      console.error('Failed to like/unlike track:', error);
      // Revert on error
      setLikesCount(previousLikesCount);
      setIsLikedByUser(previousIsLiked);
    }
  };

  const handleDeleteClick = () => {
    if (!onDelete) return;
    if (window.confirm(`Delete "${track.title}"? This cannot be undone.`)) {
      onDelete(track);
    }
  };

  const handleSubmitReport = async () => {
    if (!user) return;
    setIsSubmittingReport(true);
    try {
      const { data: result, error } = await supabase.rpc('submit_track_report', {
        p_track_id: track.id,
        p_reason: reportReason,
        p_details: reportDetails.trim() || null,
      });
      if (error) throw error;
      if (result === 'already_reported') {
        alert('You have already reported this track.');
        handleCloseReportModal();
        return;
      }
      setReportDone(true);
      setTimeout(() => {
        setReportDone(false);
        setReportDetails('');
        setReportReason('copyright');
        setShowReportModal(false);
      }, 1500);
    } catch (error) {
      console.error('Failed to submit report:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleCloseReportModal = () => {
    setReportDetails('');
    setReportReason('copyright');
    setReportDone(false);
    setShowReportModal(false);
  };

  // Load playlists when modal opens (own playlists + shared playlists)
  useEffect(() => {
    const loadPlaylists = async () => {
      if (showPlaylistModal && user) {
        try {
          // Load user's own playlists with full track data
          const userPlaylists = await MusicService.getPlaylists(user.id);
          const userPlaylistsWithTracks = await Promise.all(
            userPlaylists.map(async (playlist) => {
              try {
                const fullPlaylist = await MusicService.getPlaylistById(playlist.id);
                return fullPlaylist;
              } catch (error) {
                console.error(`Failed to load tracks for playlist ${playlist.id}:`, error);
                return playlist;
              }
            })
          );

          // Load shared playlists (accepted invitations) with full track data
          const acceptedInvitations = await MusicService.getPlaylistInvitations(user.id, 'accepted');
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
          const sharedPlaylists = sharedPlaylistsData.filter(p => p !== null);

          // Combine own playlists and shared playlists
          const allPlaylists = [...userPlaylistsWithTracks, ...sharedPlaylists];
          setPlaylists(allPlaylists);
        } catch (error) {
          console.error('Failed to load playlists:', error);
        }
      }
    };
    loadPlaylists();
  }, [showPlaylistModal, user, setPlaylists]);

  const handleCreatePlaylist = async () => {
    if (!user || !createPlaylistForm.name.trim()) {
      alert('Please enter a playlist name');
      return;
    }

    setIsCreatingPlaylist(true);
    try {
      // Create the playlist
      const newPlaylist = await MusicService.createPlaylist({
        name: createPlaylistForm.name,
        isPublic: createPlaylistForm.isPublic,
        createdBy: user.id
      });

      // Add the current track to the newly created playlist
      try {
        await MusicService.addTrackToPlaylist(newPlaylist.id, track.id);
      } catch (trackError) {
        console.error('Failed to add track to playlist (playlist was created):', trackError);
        // Don't fail the whole operation if track addition fails
      }

      // Reload playlists to get the updated list
      const userPlaylists = await MusicService.getPlaylists(user.id);
      setPlaylists(userPlaylists);

      // Dispatch event to notify other components (like Playlists page) that playlists changed
      window.dispatchEvent(new CustomEvent('playlistsChanged', {
        detail: { playlistId: newPlaylist.id, userId: user.id }
      }));

      // Reset form and close create form
      setCreatePlaylistForm({ name: '', isPublic: true });
      setShowCreatePlaylistForm(false);

      // Close the modal
      setShowPlaylistModal(false);
    } catch (error) {
      console.error('Failed to create playlist - Full error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create playlist. Please try again.';
      alert(`Failed to create playlist: ${errorMessage}\n\nPlease check the browser console for more details.`);
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  const handleMessage = async (receiverId: string) => {
    if (!user) return;

    try {
      // Send the track as a message with type 'track'
      // The content should contain the full track data as JSON for the chat system to parse
      await ChatService.sendMessage({
        senderId: user.id,
        receiverId,
        content: JSON.stringify(track),
        type: 'track'
      });

      setShowMessageModalSentId(receiverId);
      setTimeout(() => {
        setShowMessageModalSentId(null);
        setShowMessageModal(false);
        setSearchQuery('');
        setSearchResults([]);
        setMessageError(null);
      }, 800);
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : 'Failed to send track');
    }
  };

  const filterUsersLocally = (query: string) => {
    if (!query.trim()) {
      setSearchResults(allUsers);
      return;
    }

    const filtered = allUsers.filter(u =>
      u.username.toLowerCase().includes(query.toLowerCase()) ||
      (u.artistName && u.artistName.toLowerCase().includes(query.toLowerCase()))
    );
    setSearchResults(filtered);
  };

  const loadAllUsers = async () => {
    if (!user) return;

    setIsSearching(true);
    setMessageError(null);

    try {
      // Load all users when modal opens (empty search to get all users)
      const results = await ChatService.searchUsers('', user.id);
      setAllUsers(results);
      setSearchResults(results);
    } catch (error) {
      setMessageError('Failed to load users');
    } finally {
      setIsSearching(false);
    }
  };

  const closeMessageModal = () => {
    setShowMessageModal(false);
    setSearchQuery('');
    setSearchResults([]);
    setAllUsers([]);
    setMessageError(null);
    setShowMessageModalSentId(null);
  };

  // ── "More options" bottom sheet — shared between grid and row variants ────
  const optionsMenu = showMenu && createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30"
      onClick={() => setShowMenu(false)}
    >
      <div
        className="w-full sm:max-w-sm bg-[#1c1c2e] border border-[#2a2a3a] rounded-t-2xl sm:rounded-2xl p-5 mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-bold text-base truncate flex-1 mr-2">{track.title}</p>
          <button onClick={() => setShowMenu(false)} aria-label="Close">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <button
          onClick={() => { setShowMenu(false); setShowPlaylistModal(true); }}
          className="w-full flex items-center gap-3 py-3 border-b border-[#2a2a3a] text-left"
        >
          <Plus size={16} className="text-gray-300" />
          <span className="text-gray-300 text-[15px]">Add to playlist</span>
        </button>

        <button
          onClick={() => { setShowMenu(false); handleLike(); }}
          className="w-full flex items-center gap-3 py-3 border-b border-[#2a2a3a] text-left"
        >
          <Bookmark size={16} className={isLiked ? 'text-blue-400' : 'text-gray-300'} fill={isLiked ? 'currentColor' : 'none'} />
          <span className="text-gray-300 text-[15px]">{isLiked ? 'Remove bookmark' : 'Bookmark'}</span>
        </button>

        <button
          onClick={() => { setShowMenu(false); handleAddToQueue(); }}
          className="w-full flex items-center gap-3 py-3 border-b border-[#2a2a3a] text-left"
        >
          <List size={16} className="text-gray-300" />
          <span className="text-gray-300 text-[15px]">Add to queue</span>
        </button>

        <button
          onClick={() => { setShowMenu(false); setShowMessageModal(true); loadAllUsers(); }}
          className="w-full flex items-center gap-3 py-3 border-b border-[#2a2a3a] text-left"
        >
          <MessageCircle size={16} className="text-gray-300" />
          <span className="text-gray-300 text-[15px]">Send to user</span>
        </button>

        <button
          onClick={() => { setShowMenu(false); if (canRemix) goRemix(); }}
          disabled={!canRemix}
          className="w-full flex items-center gap-3 py-3 border-b border-[#2a2a3a] text-left disabled:opacity-50"
        >
          <Layers size={16} className="text-gray-300" />
          <span className="text-gray-300 text-[15px]">
            {canRemix ? 'Remix' : 'Remix (the artist hasn’t allowed remixes)'}
          </span>
        </button>

        {isRemix && (
          <button
            onClick={() => { setShowMenu(false); setShowCredits(true); }}
            className="w-full flex items-center gap-3 py-3 border-b border-[#2a2a3a] text-left"
          >
            <Layers size={16} className="text-gray-300" />
            <span className="text-gray-300 text-[15px]">Remix credits</span>
          </button>
        )}

        <button
          onClick={() => { setShowMenu(false); setShowDownload(true); }}
          className="w-full flex items-center gap-3 py-3 border-b border-[#2a2a3a] text-left"
        >
          {isOwnTrack ? <Settings2 size={16} className="text-gray-300" /> : <Download size={16} className="text-gray-300" />}
          <span className="text-gray-300 text-[15px]">{isOwnTrack ? 'Track settings' : 'Download'}</span>
        </button>

        {onDelete && (
          <button
            onClick={() => { setShowMenu(false); handleDeleteClick(); }}
            className="w-full flex items-center gap-3 py-3 border-b border-[#2a2a3a] text-left"
          >
            <X size={16} className="text-red-400" />
            <span className="text-red-400 text-[15px]">Delete</span>
          </button>
        )}

        {user && (
          <button
            onClick={() => { setShowMenu(false); setShowReportModal(true); }}
            className="w-full flex items-center gap-3 py-3 text-left"
          >
            <Flag size={16} className="text-red-400" />
            <span className="text-red-400 text-[15px]">Report</span>
          </button>
        )}

        <button
          onClick={() => setShowMenu(false)}
          className="w-full mt-2.5 py-3 rounded-xl bg-gray-600 text-white/60 font-medium text-sm"
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );

  // ── Report modal ────────────────────────────────────────────────────────────
  const reportModal = showReportModal && createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" onClick={handleCloseReportModal}>
      <div
        className="w-full sm:max-w-sm bg-[#1c1c2e] border border-[#2a2a3a] rounded-t-2xl sm:rounded-2xl p-5 mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-bold text-base">Report Track</p>
          <button onClick={handleCloseReportModal} aria-label="Close">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {reportDone ? (
          <div className="flex flex-col items-center py-6 gap-2.5">
            <Check size={32} className="text-green-400" />
            <p className="text-white font-semibold text-[15px]">Report submitted</p>
            <p className="text-gray-400 text-[13px] text-center">Our team will review this track.</p>
          </div>
        ) : (
          <>
            <p className="text-gray-400 text-[13px] mb-3.5 truncate">"{track.title}"</p>

            {REPORT_REASONS.map(r => (
              <button
                key={r.key}
                onClick={() => setReportReason(r.key)}
                className="w-full flex items-center gap-3 py-2.5 border-b border-[#2a2a3a] text-left"
              >
                <span
                  className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: reportReason === r.key ? 'var(--color-primary)' : '#4b5563' }}
                >
                  {reportReason === r.key && (
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                  )}
                </span>
                <span className="text-gray-300 text-sm">{r.label}</span>
              </button>
            ))}

            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Additional details (optional)"
              rows={2}
              className="w-full mt-3 px-3 py-2.5 bg-[#0f0f1a] border border-gray-700 rounded-lg text-white placeholder-white/25 text-sm resize-none focus:outline-none focus:border-primary-500"
            />

            <button
              onClick={handleSubmitReport}
              disabled={isSubmittingReport}
              className="w-full mt-3.5 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm transition-colors"
            >
              {isSubmittingReport ? 'Submitting…' : 'Submit Report'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );

  // ── Add to Playlist modal (shared) ──────────────────────────────────────────
  const playlistModal = showPlaylistModal && createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md relative">
        <button
          onClick={() => {
            setShowPlaylistModal(false);
            setShowCreatePlaylistForm(false);
            setCreatePlaylistForm({ name: '', isPublic: true });
          }}
          className="absolute top-3 right-3 p-1 rounded-full bg-dark-700 hover:text-gray-400 transition-colors"
          title="Close"
        >
          <X size={20} />
        </button>
        <div className="text-lg font-bold text-primary-500 mb-4">Add to Playlist</div>
        {showCreatePlaylistForm ? (
          <div className="space-y-4">
            <div>
              <label className="block text-black font-medium mb-2 text-sm">Playlist Name</label>
              <input
                type="text"
                value={createPlaylistForm.name}
                onChange={(e) => setCreatePlaylistForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Enter playlist name"
                autoFocus
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`isPublic-${track.id}`}
                checked={createPlaylistForm.isPublic}
                onChange={(e) => setCreatePlaylistForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                className="w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500"
              />
              <label htmlFor={`isPublic-${track.id}`} className="text-sm text-black">Make playlist public</label>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleCreatePlaylist}
                disabled={isCreatingPlaylist || !createPlaylistForm.name.trim()}
                className="flex-1 bg-primary-600 text-black px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 text-sm"
              >
                {isCreatingPlaylist ? 'Creating...' : 'Create & Add Track'}
              </button>
              <button
                onClick={() => { setShowCreatePlaylistForm(false); setCreatePlaylistForm({ name: '', isPublic: true }); }}
                className="flex-1 bg-gray-200 text-black px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-h-80 overflow-y-auto space-y-2 mb-3">
              {playlists.length === 0 ? (
                <p className="text-dark-400 text-center py-4">No playlists available</p>
              ) : (
                playlists.map(playlist => {
                  const isShared = (playlist as any).isShared;
                  const isTrackInPlaylist = playlist.tracks?.some(t => t.id === track.id);
                  return (
                    <button
                      key={playlist.id}
                      onClick={async () => {
                        if (isTrackInPlaylist) { alert('This track is already in the playlist'); return; }
                        try {
                          await MusicService.addTrackToPlaylist(playlist.id, track.id);
                          setShowPlaylistModal(false);
                          window.dispatchEvent(new CustomEvent('playlistsChanged', { detail: { playlistId: playlist.id, userId: user?.id } }));
                        } catch (error) {
                          alert(`Failed to add track to playlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                      }}
                      disabled={isTrackInPlaylist}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-black text-left transition-colors ${
                        isTrackInPlaylist ? 'bg-dark-700 opacity-50 cursor-not-allowed' : isShared ? 'bg-blue-900 hover:bg-blue-800 border border-blue-700' : 'bg-dark-800 hover:bg-primary-600'
                      }`}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <Music size={18} />
                        <span className="truncate font-medium">{playlist.name}</span>
                        {isShared && (
                          <span className="flex-shrink-0 px-2 py-0.5 bg-blue-600 text-black text-xs rounded-full flex items-center space-x-1">
                            <Share2 size={10} /><span>SharePlay</span>
                          </span>
                        )}
                      </div>
                      {isTrackInPlaylist && <span className="text-xs text-gray-400 flex-shrink-0 ml-2">Already added</span>}
                    </button>
                  );
                })
              )}
            </div>
            <button
              onClick={() => setShowCreatePlaylistForm(true)}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-black transition-colors"
            >
              <Plus size={18} /><span className="font-medium">Create New Playlist</span>
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );

  // ── Send track to user modal (shared) ───────────────────────────────────────
  const messageModal = showMessageModal && createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md relative">
        <div className="flex items-start justify-between mb-4">
          <div className="text-lg font-bold text-black">Send Track to User</div>
          <button
            onClick={closeMessageModal}
            className="p-1 rounded-full bg-dark-700 hover:text-gray-400 transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mb-4 p-3 bg-dark-800 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded overflow-hidden">
              <img src={track.cover || DEFAULT_TRACK_COVER} alt={track.title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-black truncate">{track.title}</div>
              <div className="text-sm text-gray-400 truncate">{track.artist}</div>
            </div>
          </div>
        </div>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); filterUsersLocally(e.target.value); }}
            className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded text-black placeholder-gray-400 focus:outline-none focus:border-primary-500"
          />
        </div>
        <div className="max-h-60 overflow-y-auto space-y-2">
          {messageError && <p className="text-red-500 text-sm text-center">{messageError}</p>}
          {isSearching && <p className="text-dark-400 text-center text-sm">Loading users...</p>}
          {!isSearching && searchResults.length === 0 && <p className="text-dark-400 text-center text-sm">No users available</p>}
          {searchResults.map(u => (
            <button
              key={u.id}
              onClick={() => handleMessage(u.id)}
              disabled={showMessageModalSentId === u.id}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-dark-800 hover:bg-primary-600 text-black text-left transition-colors disabled:opacity-60"
            >
              <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center">
                <img src={getAvatarUrl(u.avatar)} alt={u.username} className="w-full h-full rounded-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-1.5">
                  {u.username}
                  <VerifiedBadge verified={u.isVerified || u.isVerifiedArtist} size={14} />
                </div>
                {u.artistName && <div className="text-sm text-gray-400 truncate">{u.artistName}</div>}
              </div>
              {showMessageModalSentId === u.id ? (
                <Check size={16} className="text-green-500" />
              ) : (
                <MessageCircle size={16} className="text-gray-400" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );

  // ── compactGrid: vertical brutalist card ────────────────────────────────────
  if (compactGrid) {
    return (
      <>
        <div
          className="rounded-2xl bg-white p-[7px]"
          style={{ border: '3px solid #000', boxShadow: HARD_SHADOW }}
        >
          <div className="rounded-xl border-2 border-black overflow-hidden bg-white">
            {/* Square image box: padding-bottom ratio works consistently in Chrome and Firefox */}
            <div className="relative w-full bg-gray-800" style={{ paddingBottom: '100%' }}>
              <img
                src={track.cover || DEFAULT_TRACK_COVER}
                alt={track.title}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.fallback-cover-grid')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'fallback-cover-grid absolute inset-0 flex items-center justify-center text-2xl bg-gray-800';
                    fallback.textContent = '🎵';
                    parent.appendChild(fallback);
                  }
                }}
              />
              <button
                onClick={handlePlayPause}
                className="absolute inset-0 flex items-center justify-center transition-opacity"
                style={{ background: isCurrentlyPlaying ? 'rgba(0,0,0,0.4)' : 'transparent' }}
                aria-label={isCurrentlyPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
              >
                {isCurrentlyPlaying && <Pause size={28} className="text-white" />}
              </button>
            </div>

            <div className="h-0.5 bg-black" />

            {/* Info strip */}
            <div className="p-2.5">
              <p className="text-black font-bold text-[13px] truncate">
                {track.title}{track.album ? `, ${track.album}` : ''}
              </p>
              <p className="text-gray-700 text-[11px] truncate mt-0.5">{track.artist}</p>
              {((track as { licenseType?: string }).licenseType || isRemix) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <LicenseBadge license={(track as { licenseType?: string }).licenseType} />
                  {remixChip}
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                <span className="text-gray-500 text-[11px]">
                  {(track as { createdAt?: Date }).createdAt != null
                    ? new Date((track as { createdAt: Date }).createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    : formatDuration(track.duration)}
                </span>
                {user && (
                  <button
                    onClick={handleTrackLike}
                    className="flex items-center gap-0.5"
                    disabled={isLoadingLikes}
                    title={isLikedByUser ? 'Remove like' : 'Like track'}
                  >
                    <ThumbsUp size={14} className={isLikedByUser ? 'text-blue-400' : 'text-gray-400'} fill={isLikedByUser ? 'currentColor' : 'none'} />
                    <span className="text-gray-500 text-[11px]">{likesCount}</span>
                  </button>
                )}
              </div>

              {/* Action buttons row */}
              {showActions && isAuthenticated && (
                <div className="flex gap-1.5 mt-2.5">
                  <button
                    onClick={handlePlayPause}
                    className="flex-1 py-1.5 rounded-lg bg-black text-white flex items-center justify-center"
                    title={isCurrentlyPlaying ? 'Pause' : 'Play'}
                  >
                    {isCurrentlyPlaying ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button
                    onClick={handleAddToQueue}
                    className="flex-1 py-1.5 rounded-lg bg-white border border-black text-black flex items-center justify-center"
                    title="Add to queue"
                  >
                    <List size={15} />
                  </button>
                  <button
                    onClick={() => setShowPlaylistModal(true)}
                    className="flex-1 py-1.5 rounded-lg bg-white border border-black text-black flex items-center justify-center"
                    title="Add to playlist"
                  >
                    <Plus size={15} />
                  </button>
                  {canRemix && (
                    <button
                      onClick={goRemix}
                      className="flex-1 py-1.5 rounded-lg bg-teal-300 border border-black text-black flex items-center justify-center"
                      title="Remix"
                      aria-label={`Remix ${track.title}`}
                    >
                      <Layers size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => setShowMenu(true)}
                    className="flex-1 py-1.5 rounded-lg bg-white border border-black text-black flex items-center justify-center"
                    title="More options"
                  >
                    <MoreVertical size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {optionsMenu}
        {downloadDialog}
        {creditsDialog}
        {playlistModal}
        {messageModal}
        {reportModal}
      </>
    );
  }

  // ── Default: brutalist row card (all breakpoints) ───────────────────────────
  return (
    <>
      <div
        className="flex items-center gap-3 p-3 bg-white text-black w-full min-w-0 min-h-[72px]"
        style={{ border: '2px solid #121212', boxShadow: HARD_SHADOW }}
      >
        {/* Album art — tappable to play/pause */}
        <button
          onClick={handlePlayPause}
          className="flex-shrink-0 relative w-[60px] h-[60px] overflow-hidden bg-gray-800 active:scale-95 transition-transform"
          aria-label={isCurrentlyPlaying ? `Pause ${track.title}` : `Play ${track.title} by ${track.artist}`}
        >
          <img
            src={track.cover || DEFAULT_TRACK_COVER}
            alt={track.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent && !parent.querySelector('.fallback-cover-row')) {
                const fallback = document.createElement('div');
                fallback.className = 'fallback-cover-row w-full h-full flex items-center justify-center text-2xl bg-gray-800';
                fallback.textContent = '🎵';
                parent.appendChild(fallback);
              }
            }}
          />
          {isCurrentlyPlaying && (
            <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
              <Pause size={18} className="text-white" />
            </div>
          )}
        </button>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="font-bold text-sm truncate">{track.title}</div>
          <div className="text-gray-700 text-xs truncate">{track.artist}{track.album ? ` • ${track.album}` : ''}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-500 text-xs">{formatDuration(track.duration)}</span>
            <LicenseBadge license={(track as { licenseType?: string }).licenseType} />
            {remixChip}
            {user && (
              <button
                onClick={handleTrackLike}
                className="flex items-center gap-0.5 text-xs min-h-[44px] px-1"
                disabled={isLoadingLikes}
              >
                <ThumbsUp size={14} className={isLikedByUser ? 'text-blue-400' : 'text-gray-400'} fill={isLikedByUser ? 'currentColor' : 'none'} />
                <span className="text-gray-500">{likesCount}</span>
              </button>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handlePlayPause}
            className="w-11 h-11 rounded-full bg-[#121212] text-white flex items-center justify-center active:scale-95 transition-transform"
            aria-label={isCurrentlyPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          >
            {isCurrentlyPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          {showActions && canRemix && (
            <button
              onClick={goRemix}
              className="flex w-11 h-11 rounded-full border-2 border-black bg-teal-300 text-black items-center justify-center active:scale-95 transition-transform"
              aria-label={`Remix ${track.title}`}
              title="Remix"
            >
              <Layers size={18} />
            </button>
          )}
          {showActions && isAuthenticated && (
            <button
              onClick={() => setShowMenu(true)}
              className="w-11 h-11 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label={`More options for ${track.title}`}
            >
              <MoreVertical size={18} />
            </button>
          )}
        </div>
      </div>

      {optionsMenu}
      {downloadDialog}
      {creditsDialog}
      {playlistModal}
      {messageModal}
      {reportModal}
    </>
  );
};

export default TrackCard;
