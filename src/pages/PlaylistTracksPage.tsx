import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
  Play,
  Pause,
  Shuffle,
  UserPlus,
  Clock,
  Plus,
  X,
  Search,
  Check,
  Users,
  UserMinus,
  Mail,
  ArrowLeft,
  Lock,
  Globe,
  ImagePlus,
  Music2,
  Loader2,
  ListMusic,
} from 'lucide-react';
import { createDisplayName } from '../utils/debugUtils';
import { MusicService } from '../services/musicService';
import { ChatService } from '../services/chatService';
import { supabase } from '../services/supabase';
import { getAvatarUrl } from '../utils/avatar';
import { useAlerts } from '../contexts/AlertContext';
import { BrutalButton, brutalInput, hardShadow } from '../components/ui/brutal';

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/** "1 hr 12 min" / "23 min" */
const formatTotal = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h} hr ${m} min` : `${m} min`;
};

// ─── Shared shells ───────────────────────────────────────────────────────────
const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-full bg-[#faf6ec] px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-10">
    <div className="max-w-5xl mx-auto">{children}</div>
  </div>
);

const StateCard: React.FC<{ icon: React.ReactNode; title: string; children?: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="min-h-full bg-[#faf6ec] px-4 py-16 flex items-center justify-center">
    <div className="max-w-md w-full bg-white border-2 border-black rounded-2xl p-8 text-center" style={hardShadow(6)}>
      <span className="w-14 h-14 rounded-2xl border-2 border-black bg-teal-300 flex items-center justify-center mx-auto mb-5">{icon}</span>
      <h1 className="font-kotra text-3xl text-black mb-2">{title}</h1>
      {children}
    </div>
  </div>
);

const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }> = ({
  title, onClose, children, footer, wide,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? 'sm:max-w-xl' : 'sm:max-w-md'} max-h-[85vh] flex flex-col bg-[#faf6ec] border-2 border-black rounded-t-2xl sm:rounded-2xl`}
        style={hardShadow(6)}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="!text-lg !font-bold !m-0 text-black truncate">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg border-2 border-black bg-white flex items-center justify-center flex-shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="px-5 pb-5 flex-shrink-0">{footer}</div>}
      </div>
    </div>
  );
};

/** Animated "now playing" bars. */
const NowPlaying: React.FC<{ paused?: boolean }> = ({ paused }) => (
  <span className="flex items-end gap-[2px] h-3.5" aria-label={paused ? 'Paused' : 'Now playing'}>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className={`w-[3px] bg-teal-600 rounded-sm ${paused ? '' : 'animate-pulse'}`}
        style={{ height: paused ? 5 : [9, 14, 7][i], animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </span>
);

const PlaylistTracksPage: React.FC = () => {
  const { playlistId } = useParams<{ playlistId: string }>();
  const { playlists, player, playTrack, playQueue, pauseTrack, resumeTrack, user, setPlaylists } = useStore();
  const navigate = useNavigate();
  const { addAlert } = useAlerts();

  const [isChangingCover, setIsChangingCover] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddTrackModal, setShowAddTrackModal] = useState(false);
  const [availableTracks, setAvailableTracks] = useState<any[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Invitation states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  // Collaborators states
  const [showCollaboratorsSection, setShowCollaboratorsSection] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [pendingInvitesSent, setPendingInvitesSent] = useState<any[]>([]);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);

  const playlist: any = playlists.find((p: any) => p.id === playlistId);
  const isOwner = !!(user && playlist && user.id === playlist.createdBy);

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
        setPendingInvitations(invitations.filter((inv: any) => inv.playlists?.id === playlistId));
      } catch (error) {
        console.error('Failed to load invitations:', error);
      }
    };
    loadInvitations();
  }, [user, playlistId]);

  const refreshCollaborators = async () => {
    if (!playlistId || !isOwner || !user) return;
    const [collabs, pending] = await Promise.all([
      MusicService.getPlaylistCollaborators(playlistId),
      MusicService.getPlaylistPendingInvitations(playlistId, user.id),
    ]);
    setCollaborators(collabs);
    setPendingInvitesSent(pending);
  };

  // Load collaborators and pending invitations sent (for owner)
  useEffect(() => {
    if (!playlistId || !isOwner || !user) return;
    setIsLoadingCollaborators(true);
    refreshCollaborators()
      .catch((error) => console.error('Failed to load collaborators:', error))
      .finally(() => setIsLoadingCollaborators(false));
  }, [playlistId, isOwner, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch playlist data if not available in store
  useEffect(() => {
    const fetchPlaylist = async () => {
      if (!playlistId) return;
      if (!playlist || playlist.tracks.length === 0) {
        setIsLoading(true);
        try {
          const fetchedPlaylist = await MusicService.getPlaylistById(playlistId);
          if (playlist) {
            setPlaylists(playlists.map((p: any) => (p.id === playlistId ? fetchedPlaylist : p)));
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
      addAlert('Couldn’t load tracks. Please try again.', 'error');
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const openAddTracks = () => {
    setTrackSearch('');
    setShowAddTrackModal(true);
    loadAvailableTracks();
  };

  const refreshPlaylist = async (id: string) => {
    const updatedPlaylist = await MusicService.getPlaylistById(id);
    setPlaylists(playlists.map((p: any) => (p.id === id ? updatedPlaylist : p)));
  };

  const handleAddTrackToPlaylist = async (track: any) => {
    if (!playlist || !hasAccess) return;
    if (playlist.tracks.find((t: any) => t.id === track.id)) {
      addAlert('That track is already in this playlist.', 'info');
      return;
    }
    setAddingId(track.id);
    try {
      await MusicService.addTrackToPlaylist(playlist.id, track.id);
      await refreshPlaylist(playlist.id);
      addAlert(`Added “${track.title}”`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('duplicate key') || message.includes('unique constraint')) {
        addAlert('That track is already in this playlist.', 'info');
      } else {
        console.error('Failed to add track to playlist:', error);
        addAlert(`Couldn’t add the track: ${message}`, 'error');
      }
    } finally {
      setAddingId(null);
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
      setInvitedIds((ids) => [...ids, inviteeId]);
      addAlert('Invitation sent', 'success');
      if (isOwner) await refreshCollaborators();
    } catch (error) {
      console.error('Failed to send invitation:', error);
      addAlert(`Couldn’t send the invitation: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    if (!user) return;
    try {
      await MusicService.acceptPlaylistInvitation(invitationId, user.id);
      setHasAccess(true);
      setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      addAlert('Invitation accepted — you can now add tracks to this playlist.', 'success');
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      addAlert(`Couldn’t accept the invitation: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    if (!user) return;
    try {
      await MusicService.declinePlaylistInvitation(invitationId, user.id);
      setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      addAlert(`Couldn’t decline the invitation: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleRemoveCollaborator = async (invitationId: string, username: string) => {
    if (!user || !isOwner || !playlistId) return;
    if (!confirm(`Remove ${username}? They will lose access to this playlist.`)) return;
    try {
      await MusicService.removeCollaborator(invitationId, user.id);
      await refreshCollaborators();
      addAlert(`${username} removed`, 'success');
    } catch (error) {
      console.error('Failed to remove collaborator:', error);
      addAlert(`Couldn’t remove the collaborator: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!playlist || !hasAccess) return;
    setRemovingId(trackId);
    try {
      await MusicService.removeTrackFromPlaylist(playlist.id, trackId);
      await refreshPlaylist(playlist.id);
    } catch (error) {
      console.error('Failed to remove track:', error);
      addAlert(`Couldn’t remove the track: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!user || !isOwner || !playlistId) return;
    try {
      await MusicService.cancelInvitation(invitationId, user.id);
      const pending = await MusicService.getPlaylistPendingInvitations(playlistId, user.id);
      setPendingInvitesSent(pending);
      addAlert('Invitation cancelled', 'success');
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      addAlert(`Couldn’t cancel the invitation: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleChangeCover = async (coverUrl: string) => {
    if (!user || !playlist) return;
    setIsChangingCover(true);
    try {
      await MusicService.updatePlaylist(playlist.id, user.id, { cover: coverUrl });
      setPlaylists(playlists.map((p: any) => (p.id === playlist.id ? { ...p, cover: coverUrl } : p)));
      setShowCoverModal(false);
      setCoverUrlInput('');
    } catch (error) {
      console.error('Failed to update playlist cover:', error);
      addAlert('Couldn’t update the cover. Please try again.', 'error');
    } finally {
      setIsChangingCover(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!user || !playlist) return;
    if (file.size > 5 * 1024 * 1024) {
      addAlert('That image is over 5 MB.', 'warning');
      return;
    }
    setIsChangingCover(true);
    try {
      const fileName = `playlist-covers/${playlist.id}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('music-files').upload(fileName, file);
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from('music-files').getPublicUrl(fileName);
      await handleChangeCover(urlData.publicUrl);
    } catch (error) {
      console.error('Failed to upload playlist cover:', error);
      addAlert('Couldn’t upload the cover. Please try again.', 'error');
      setIsChangingCover(false);
    }
  };

  // ── Derived ──
  const tracks: any[] = playlist?.tracks ?? [];
  const totalSeconds = useMemo(() => tracks.reduce((s, t) => s + (Number(t.duration) || 0), 0), [tracks]);
  const currentId = player.currentTrack?.id;
  const playlistIsCurrent = !!currentId && tracks.some((t) => t.id === currentId);
  const filteredAvailable = useMemo(() => {
    const q = trackSearch.trim().toLowerCase();
    return availableTracks.filter((t) => !q || t.title?.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q));
  }, [availableTracks, trackSearch]);

  // ── States ──
  if ((isLoading || isCheckingAccess) && !playlist) {
    return (
      <div className="min-h-full bg-[#faf6ec] flex items-center justify-center py-28">
        <Loader2 size={28} className="animate-spin text-black/40" aria-label="Loading playlist" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <StateCard icon={<ListMusic size={26} />} title="Playlist not found">
        <p className="text-sm text-black/60 mb-6">It may have been deleted, or the link is wrong.</p>
        <BrutalButton className="w-full" onClick={() => navigate('/playlists')}>Back to playlists</BrutalButton>
      </StateCard>
    );
  }

  if (!hasAccess && !isOwner) {
    return (
      <StateCard icon={<Lock size={24} />} title="Private playlist">
        <p className="text-sm text-black/60 mb-6">
          {pendingInvitations.length > 0
            ? `You’ve been invited to collaborate on “${playlist.name}”.`
            : 'You don’t have access to this playlist.'}
        </p>
        {pendingInvitations.length > 0 && (
          <div className="flex gap-3 mb-3">
            <BrutalButton tone="teal" className="flex-1" onClick={() => handleAcceptInvitation(pendingInvitations[0].id)}>
              <Check size={16} /> Accept
            </BrutalButton>
            <BrutalButton tone="white" className="flex-1" onClick={() => handleDeclineInvitation(pendingInvitations[0].id)}>
              Decline
            </BrutalButton>
          </div>
        )}
        <BrutalButton tone={pendingInvitations.length ? 'white' : 'black'} className="w-full" onClick={() => navigate('/playlists')}>
          Back to playlists
        </BrutalButton>
      </StateCard>
    );
  }

  const handlePlayPlaylist = () => {
    if (tracks.length === 0) return;
    if (playlistIsCurrent) {
      if (player.isPlaying) pauseTrack();
      else resumeTrack();
      return;
    }
    playQueue(tracks);
  };

  const handleShuffle = () => {
    if (tracks.length === 0) return;
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    playQueue(shuffled);
  };

  const handlePlayTrack = (track: any) => {
    if (track.id === currentId) {
      if (player.isPlaying) pauseTrack();
      else resumeTrack();
      return;
    }
    // Queue the rest of the playlist from this track on.
    const i = tracks.findIndex((t) => t.id === track.id);
    if (i >= 0) playQueue([...tracks.slice(i), ...tracks.slice(0, i)]);
    else playTrack(track);
  };

  const playlistCover = playlist.cover || tracks[0]?.cover || FALLBACK_COVER;
  const playingAll = playlistIsCurrent && player.isPlaying;

  return (
    <PageShell>
      <button
        type="button"
        onClick={() => navigate('/playlists')}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-black/60 hover:text-black mb-5"
      >
        <ArrowLeft size={16} /> Playlists
      </button>

      {/* ── Header ── */}
      <header className="flex flex-col sm:flex-row gap-6 sm:items-end mb-8">
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex-shrink-0 mx-auto sm:mx-0 rounded-2xl border-2 border-black overflow-hidden bg-white group/cover" style={hardShadow(6)}>
          <img
            src={playlistCover}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_COVER; }}
          />
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowCoverModal(true)}
              className="absolute inset-x-2 bottom-2 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-white text-xs font-bold text-black shadow-[2px_2px_0_0_#000]
                sm:opacity-0 sm:group-hover/cover:opacity-100 focus:opacity-100 transition-opacity"
            >
              <ImagePlus size={14} /> Change cover
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-black/60 mb-1">Playlist</p>
          <h1 className="font-kotra text-4xl sm:text-5xl text-black leading-none break-words">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-sm text-black/70 mt-2 line-clamp-2">{playlist.description}</p>
          )}

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-2 mt-3 text-sm text-black/70">
            <span className="font-semibold text-black">{tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}</span>
            {totalSeconds > 0 && <span>· {formatTotal(totalSeconds)}</span>}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border-2 border-black bg-white text-xs font-bold">
              {playlist.isPublic ? <><Globe size={12} /> Public</> : <><Lock size={12} /> Private</>}
            </span>
            {collaborators.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="flex -space-x-2">
                  {collaborators.slice(0, 4).map((c) => (
                    <img key={c.id} src={getAvatarUrl(c.avatar)} alt={c.username} title={c.username} className="w-6 h-6 rounded-full border-2 border-black object-cover bg-white" />
                  ))}
                </span>
                {collaborators.length} collaborator{collaborators.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-5">
            <button
              type="button"
              onClick={handlePlayPlaylist}
              disabled={tracks.length === 0}
              aria-label={playingAll ? 'Pause playlist' : 'Play playlist'}
              className="w-14 h-14 rounded-full border-2 border-black bg-black text-white flex items-center justify-center shadow-[3px_3px_0_0_#0d9488] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all disabled:opacity-40"
            >
              {playingAll ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
            </button>
            <BrutalButton size="sm" tone="white" onClick={handleShuffle} disabled={tracks.length < 2} aria-label="Shuffle play">
              <Shuffle size={14} /> Shuffle
            </BrutalButton>
            {hasAccess && (
              <BrutalButton size="sm" tone="teal" onClick={openAddTracks}>
                <Plus size={14} /> Add tracks
              </BrutalButton>
            )}
            {isOwner && (
              <>
                <BrutalButton size="sm" tone="white" onClick={() => { setInvitedIds([]); setShowInviteModal(true); }}>
                  <UserPlus size={14} /> Invite
                </BrutalButton>
                <BrutalButton
                  size="sm"
                  tone={showCollaboratorsSection ? 'black' : 'white'}
                  onClick={() => setShowCollaboratorsSection((v) => !v)}
                  aria-expanded={showCollaboratorsSection}
                >
                  <Users size={14} /> Collaborators{pendingInvitesSent.length > 0 ? ` · ${pendingInvitesSent.length} pending` : ''}
                </BrutalButton>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Pending invitation (has access via another route but invite still open) ── */}
      {pendingInvitations.length > 0 && !hasAccess && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 border-black bg-yellow-200">
          <p className="text-sm font-semibold text-black flex items-center gap-2"><Mail size={16} /> You’re invited to collaborate on this playlist.</p>
          <div className="flex gap-2">
            <BrutalButton size="sm" tone="black" onClick={() => handleAcceptInvitation(pendingInvitations[0].id)}><Check size={14} /> Accept</BrutalButton>
            <BrutalButton size="sm" tone="white" onClick={() => handleDeclineInvitation(pendingInvitations[0].id)}>Decline</BrutalButton>
          </div>
        </div>
      )}

      {/* ── Collaborators ── */}
      {isOwner && showCollaboratorsSection && (
        <section className="mb-8 bg-white border-2 border-black rounded-2xl p-5" style={hardShadow(4)}>
          <h2 className="!text-base !font-bold !m-0 !mb-4 text-black flex items-center gap-2"><Users size={16} /> Collaborators</h2>
          {isLoadingCollaborators ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-black/40" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-black/60 mb-2">Active · {collaborators.length}</p>
                {collaborators.length === 0 ? (
                  <p className="text-sm text-black/60">
                    No collaborators yet.{' '}
                    <button type="button" className="underline font-semibold text-black" onClick={() => { setInvitedIds([]); setShowInviteModal(true); }}>Invite someone</button>
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {collaborators.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 p-2 rounded-xl border-2 border-black/15">
                        <img src={getAvatarUrl(c.avatar)} alt="" className="w-8 h-8 rounded-full border-2 border-black object-cover" />
                        <span className="flex-1 min-w-0 text-sm font-semibold text-black truncate">{c.username}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCollaborator(c.invitationId, c.username)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-black bg-white text-xs font-bold text-red-700 hover:bg-red-50"
                        >
                          <UserMinus size={12} /> Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-black/60 mb-2">Pending · {pendingInvitesSent.length}</p>
                {pendingInvitesSent.length === 0 ? (
                  <p className="text-sm text-black/60">No open invitations.</p>
                ) : (
                  <ul className="space-y-2">
                    {pendingInvitesSent.map((inv) => (
                      <li key={inv.invitationId} className="flex items-center gap-3 p-2 rounded-xl border-2 border-dashed border-black/30">
                        <img src={getAvatarUrl(inv.avatar)} alt="" className="w-8 h-8 rounded-full border-2 border-black object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-black truncate">{inv.username}</p>
                          <p className="text-[11px] text-black/50">Invited {new Date(inv.createdAt).toLocaleDateString()}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCancelInvitation(inv.invitationId)}
                          className="px-2.5 py-1 rounded-lg border-2 border-black bg-white text-xs font-bold text-black hover:bg-black/5"
                        >
                          Cancel
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Tracks ── */}
      {tracks.length === 0 ? (
        <section className="bg-white border-2 border-black rounded-2xl px-6 py-14 text-center" style={hardShadow(4)}>
          <Music2 size={32} className="mx-auto mb-3 text-black/30" />
          <p className="font-bold text-black">This playlist is empty</p>
          <p className="text-sm text-black/60 mt-1 mb-5">
            {hasAccess ? 'Add some tracks to get it going.' : 'The owner hasn’t added any tracks yet.'}
          </p>
          {hasAccess && <BrutalButton tone="teal" onClick={openAddTracks}><Plus size={16} /> Add tracks</BrutalButton>}
        </section>
      ) : (
        <section className="bg-white border-2 border-black rounded-2xl overflow-hidden" style={hardShadow(4)} aria-label="Tracks">
          <div className="hidden md:grid grid-cols-[48px_minmax(0,1fr)_minmax(0,220px)_64px_44px] gap-4 px-4 py-2.5 border-b-2 border-black bg-black/[0.03] text-xs font-bold uppercase tracking-wide text-black/60">
            <span className="text-center">#</span>
            <span>Title</span>
            <span>Album</span>
            <span className="flex justify-end"><Clock size={14} aria-label="Duration" /></span>
            <span />
          </div>
          <ol>
            {tracks.map((track: any, index: number) => {
              const isCurrent = track.id === currentId;
              const isPlayingNow = isCurrent && player.isPlaying;
              return (
                <li
                  key={createDisplayName(track.id)}
                  className={`group grid grid-cols-[40px_minmax(0,1fr)_auto_auto] md:grid-cols-[48px_minmax(0,1fr)_minmax(0,220px)_64px_44px] items-center gap-3 md:gap-4 px-3 md:px-4 py-2.5 border-b border-black/10 last:border-b-0 transition-colors
                    ${isCurrent ? 'bg-teal-50' : 'hover:bg-black/[0.03]'}`}
                >
                  <button
                    type="button"
                    onClick={() => handlePlayTrack(track)}
                    aria-label={isPlayingNow ? `Pause ${track.title}` : `Play ${track.title}`}
                    className="w-8 h-8 mx-auto rounded-full flex items-center justify-center text-sm tabular-nums text-black/50 hover:bg-black hover:text-white focus-visible:bg-black focus-visible:text-white"
                  >
                    {isCurrent ? (
                      <>
                        <span className="group-hover:hidden"><NowPlaying paused={!player.isPlaying} /></span>
                        <span className="hidden group-hover:block">{player.isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</span>
                      </>
                    ) : (
                      <>
                        <span className="group-hover:hidden">{index + 1}</span>
                        <Play size={14} fill="currentColor" className="hidden group-hover:block ml-0.5" />
                      </>
                    )}
                  </button>

                  <button type="button" onClick={() => handlePlayTrack(track)} className="flex items-center gap-3 min-w-0 text-left">
                    <img
                      src={track.cover || FALLBACK_COVER}
                      alt=""
                      className="w-11 h-11 rounded-lg border-2 border-black object-cover flex-shrink-0 bg-black/5"
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_COVER; }}
                    />
                    <span className="min-w-0">
                      <span className={`block text-sm font-bold truncate ${isCurrent ? 'text-teal-800' : 'text-black'}`}>{track.title}</span>
                      <span className="block text-xs text-black/60 truncate">{track.artist}</span>
                    </span>
                  </button>

                  <span className="hidden md:block text-sm text-black/60 truncate">{track.album || '—'}</span>

                  <span className="text-sm text-black/60 tabular-nums text-right">{formatDuration(track.duration)}</span>

                  {hasAccess ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveTrack(track.id)}
                      disabled={removingId === track.id}
                      aria-label={`Remove ${track.title} from playlist`}
                      title="Remove from playlist"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-black/40 hover:text-red-700 hover:bg-red-50 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-100"
                    >
                      {removingId === track.id ? <Loader2 size={14} className="animate-spin" /> : <X size={16} />}
                    </button>
                  ) : (
                    <span className="hidden md:block" />
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* ── Add tracks ── */}
      {showAddTrackModal && (
        <Sheet
          title={`Add to “${playlist.name}”`}
          onClose={() => setShowAddTrackModal(false)}
          wide
          footer={<BrutalButton className="w-full" onClick={() => setShowAddTrackModal(false)}>Done</BrutalButton>}
        >
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40" />
            <input
              autoFocus
              value={trackSearch}
              onChange={(e) => setTrackSearch(e.target.value)}
              placeholder="Search by title or artist"
              className={`${brutalInput} pl-10`}
            />
          </div>
          {isLoadingTracks ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-black/40" /></div>
          ) : filteredAvailable.length === 0 ? (
            <p className="text-center text-sm text-black/60 py-12">{trackSearch ? `No tracks match “${trackSearch}”.` : 'No tracks available.'}</p>
          ) : (
            <ul className="space-y-2">
              {filteredAvailable.map((track) => {
                const added = tracks.some((t) => t.id === track.id);
                return (
                  <li key={track.id} className="flex items-center gap-3 p-2 bg-white border-2 border-black rounded-xl">
                    <img src={track.cover || FALLBACK_COVER} alt="" className="w-10 h-10 rounded-lg border-2 border-black object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-black truncate">{track.title}</p>
                      <p className="text-xs text-black/60 truncate">{track.artist} · {formatDuration(track.duration)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddTrackToPlaylist(track)}
                      disabled={added || addingId === track.id}
                      className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-black text-xs font-bold bg-teal-300 shadow-[2px_2px_0_0_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:bg-white disabled:shadow-none disabled:opacity-60"
                    >
                      {addingId === track.id ? <Loader2 size={13} className="animate-spin" /> : added ? <><Check size={13} /> Added</> : <><Plus size={13} /> Add</>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Sheet>
      )}

      {/* ── Cover ── */}
      {showCoverModal && (
        <Sheet title="Change cover" onClose={() => setShowCoverModal(false)}>
          <div className="space-y-5">
            <label
              className={`flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed text-center cursor-pointer transition-colors
                ${isDragOver ? 'border-black bg-teal-100' : 'border-black/40 bg-white hover:border-black'}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file?.type.startsWith('image/')) handleFileUpload(file);
              }}
            >
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={isChangingCover}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
              />
              <span className="w-10 h-10 rounded-full border-2 border-black bg-teal-300 flex items-center justify-center">
                {isChangingCover ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
              </span>
              <span className="text-sm font-bold text-black">{isChangingCover ? 'Uploading…' : isDragOver ? 'Drop it here' : 'Upload an image'}</span>
              <span className="text-xs text-black/60">Click or drag · PNG or JPG, up to 5 MB</span>
            </label>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-black/60 mb-2">Or paste an image URL</p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={coverUrlInput}
                  onChange={(e) => setCoverUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 min-w-0 px-3 py-2 bg-white border-2 border-black rounded-lg text-sm focus:outline-none focus:shadow-[2px_2px_0_0_#000]"
                />
                <BrutalButton size="sm" onClick={() => coverUrlInput.trim() && handleChangeCover(coverUrlInput.trim())} disabled={isChangingCover || !coverUrlInput.trim()}>
                  Apply
                </BrutalButton>
              </div>
            </div>

            {tracks.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-black/60 mb-2">Or use a track cover</p>
                <div className="grid grid-cols-5 gap-2">
                  {tracks.slice(0, 10).map((track: any) => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => handleChangeCover(track.cover)}
                      disabled={isChangingCover}
                      title={track.title}
                      className={`aspect-square rounded-lg border-2 overflow-hidden transition-transform hover:-translate-y-0.5 disabled:opacity-50 ${playlist.cover === track.cover ? 'border-black shadow-[2px_2px_0_0_#000]' : 'border-black/30'}`}
                    >
                      <img src={track.cover} alt={`Cover of ${track.title}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Sheet>
      )}

      {/* ── Invite ── */}
      {showInviteModal && (
        <Sheet
          title="Invite collaborators"
          onClose={() => { setShowInviteModal(false); setInviteSearchQuery(''); setInviteSearchResults([]); }}
        >
          <p className="text-xs text-black/60 mb-3">Collaborators can add and remove tracks in this playlist.</p>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40" />
            <input
              autoFocus
              type="text"
              placeholder="Search by username"
              value={inviteSearchQuery}
              onChange={(e) => { setInviteSearchQuery(e.target.value); handleSearchUsers(e.target.value); }}
              className={`${brutalInput} pl-10`}
            />
          </div>
          {isSearchingUsers ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-black/40" /></div>
          ) : inviteSearchResults.length === 0 ? (
            <p className="text-center text-sm text-black/60 py-8">{inviteSearchQuery ? 'No users found.' : 'Search for someone to invite.'}</p>
          ) : (
            <ul className="space-y-2">
              {inviteSearchResults.map((u) => {
                const isCollaborator = collaborators.some((c) => c.id === u.id);
                const isPending = invitedIds.includes(u.id) || pendingInvitesSent.some((p) => p.id === u.id || p.userId === u.id);
                return (
                  <li key={u.id} className="flex items-center gap-3 p-2 bg-white border-2 border-black rounded-xl">
                    <img src={getAvatarUrl(u.avatar)} alt="" className="w-9 h-9 rounded-full border-2 border-black object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-black truncate">{u.username}</p>
                      {u.artistName && <p className="text-xs text-black/60 truncate">{u.artistName}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInviteUser(u.id)}
                      disabled={isCollaborator || isPending}
                      className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-black text-xs font-bold bg-teal-300 shadow-[2px_2px_0_0_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:bg-white disabled:shadow-none disabled:opacity-60"
                    >
                      {isCollaborator ? 'Collaborator' : isPending ? <><Check size={13} /> Invited</> : <><UserPlus size={13} /> Invite</>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Sheet>
      )}
    </PageShell>
  );
};

export default PlaylistTracksPage;
