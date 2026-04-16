import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Play, Music2, Mic2, Copy, Check,
  ExternalLink, Twitter, Share2, Loader2,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { MusicService } from '../services/musicService';
import { getAvatarUrl } from '../utils/avatar';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TrackPreview {
  title: string;
  cover: string | null;
  genre: string;
  releaseType: 'single' | 'album';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const LiveDot = () => (
  <span className="relative flex h-2.5 w-2.5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
  </span>
);

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';

// ── Listener's-eye profile preview ───────────────────────────────────────────
const ProfilePreview: React.FC<{
  avatar: string | null;
  displayName: string;
  handle: string;
  bio: string;
  genres: string[];
  track: TrackPreview | null;
}> = ({ avatar, displayName, handle, bio, genres, track }) => {
  const name = displayName || handle;
  const coverSrc = track?.cover || DEFAULT_COVER;

  return (
    <div className="rounded-2xl overflow-hidden bg-dark-800 border border-white/8 shadow-2xl w-full">

      {/* Banner */}
      <div className="h-20 bg-gradient-to-br from-violet-600/50 via-primary-600/35 to-fuchsia-600/40" />

      {/* Identity row */}
      <div className="px-5 pb-1 -mt-8">
        <div className="flex items-end gap-3 mb-3">
          <div className="w-16 h-16 rounded-full border-3 border-dark-800 overflow-hidden bg-dark-700 flex-shrink-0 ring-2 ring-white/10">
            {avatar && avatar !== '/default-avatar.jpg'
              ? <img src={getAvatarUrl(avatar)} alt={name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600/40 to-primary-600/40">
                  <Mic2 size={22} className="text-white/60" />
                </div>
            }
          </div>
          {/* Follow button — purely visual */}
          <div className="flex-1" />
          <div className="mb-1 px-4 py-1.5 rounded-full bg-white text-dark-900 text-xs font-semibold select-none">
            Follow
          </div>
        </div>

        <h2 className="font-bold text-white leading-tight" style={{ fontSize: '1.05rem' }}>{name}</h2>
        <p className="text-sm text-white/40 mt-0.5 mb-3">@{handle}</p>

        {bio && <p className="text-sm text-white/60 mb-3 line-clamp-2">{bio}</p>}

        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {genres.map(g => (
              <span key={g} className="text-xs px-2.5 py-0.5 rounded-full bg-primary-500/12 text-primary-300 border border-primary-500/20">
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-5 py-3 border-t border-white/6 mb-4">
          {[['1', 'Track'], ['0', 'Followers'], ['0', 'Following']].map(([n, l]) => (
            <div key={l}>
              <span className="text-sm font-bold text-white">{n}</span>
              <span className="text-xs text-white/30 ml-1">{l}</span>
            </div>
          ))}
        </div>

        {/* Track card */}
        {track && (
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2.5 font-medium">Music</p>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-dark-700/50 border border-white/6">
              <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-dark-600">
                <img src={coverSrc} alt={track.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{track.title}</p>
                <p className="text-xs text-white/35 mt-0.5">
                  {track.releaseType === 'album' ? 'Album' : 'Single'}
                  {track.genre ? ` · ${track.genre}` : ''}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                <Play size={12} className="text-primary-400 ml-0.5" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Copy button ───────────────────────────────────────────────────────────────
const CopyButton: React.FC<{ url: string }> = ({ url }) => {
  const [state, setState] = useState<'idle' | 'copied'>('idle');

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(url); } catch { /* noop */ }
    setState('copied');
    setTimeout(() => setState('idle'), 2200);
  };

  return (
    <motion.button
      onClick={handleCopy}
      whileTap={{ scale: 0.97 }}
      className={`w-full relative flex items-center justify-center gap-2.5 py-4 rounded-2xl font-semibold text-base transition-all duration-300 overflow-hidden ${
        state === 'copied'
          ? 'bg-emerald-500 text-white'
          : 'bg-gradient-to-r from-primary-600 to-secondary-600 text-white hover:from-primary-500 hover:to-secondary-500'
      }`}
    >
      {/* Ripple on copy */}
      <AnimatePresence>
        {state === 'copied' && (
          <motion.span
            key="ripple"
            className="absolute inset-0 bg-white/20 rounded-2xl"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {state === 'copied' ? (
          <motion.span
            key="copied"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2"
          >
            <Check size={18} strokeWidth={2.5} />
            Link copied!
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2"
          >
            <Copy size={17} />
            Copy link
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const OnboardingLive: React.FC = () => {
  const { user, isAuthenticated } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Track data passed from upload step, or fetched as fallback
  const stateTrack = (location.state as { track?: TrackPreview } | null)?.track ?? null;
  const [track, setTrack] = useState<TrackPreview | null>(stateTrack);
  const [isLoadingTrack, setIsLoadingTrack] = useState(!stateTrack);

  // Redirect non-auth and non-musician users
  useEffect(() => {
    if (user) {
      if (user.role !== 'musician') navigate('/');
      return;
    }
    if (!isAuthenticated) {
      const t = setTimeout(() => navigate('/signup'), 8000);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated, user, navigate]);

  // Fallback: fetch latest track if state wasn't passed (e.g. page refresh)
  useEffect(() => {
    if (stateTrack || !user) return;
    MusicService.getUserTracks(user.id)
      .then(tracks => {
        if (tracks.length > 0) {
          const t = tracks[0];
          setTrack({ title: t.title, cover: t.cover ?? null, genre: t.genre ?? '', releaseType: 'single' });
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingTrack(false));
  }, [user, stateTrack]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-white/30" />
      </div>
    );
  }

  const profileUrl = `${window.location.origin}/profile/${user.id}`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Just dropped my first track on Remixr 🎵`)}&url=${encodeURIComponent(profileUrl)}`;

  const displayName = user.artistName || user.username;
  const handle = user.username;

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900 p-4 py-10 flex items-start justify-center">
      <div className="w-full max-w-5xl">

        {/* ── Top header ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 mb-5">
            <LiveDot />
            <span className="text-xs text-emerald-300 font-semibold tracking-wide">Live on Remixr</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-3">
            You're live.
          </h1>
          <p className="text-white/40 text-base max-w-sm mx-auto">
            Your music is out there. Here's what people will see when you share the link.
          </p>
        </motion.div>

        {/* ── Two-column layout ── */}
        <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">

          {/* Left: profile preview */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
          >
            {/* "What listeners see" label */}
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-white/6" />
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-medium px-1">
                Listener view
              </p>
              <div className="h-px flex-1 bg-white/6" />
            </div>

            {isLoadingTrack ? (
              <div className="rounded-2xl bg-dark-800 border border-white/8 h-64 flex items-center justify-center">
                <Loader2 size={22} className="animate-spin text-white/20" />
              </div>
            ) : (
              <ProfilePreview
                avatar={user.avatar ?? null}
                displayName={displayName}
                handle={handle}
                bio={user.bio ?? ''}
                genres={user.genres ?? []}
                track={track}
              />
            )}
          </motion.div>

          {/* Right: share panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="lg:sticky lg:top-10 flex flex-col gap-5"
          >
            {/* URL block */}
            <div className="glass-effect rounded-2xl p-6 space-y-4">
              <div>
                <p className="text-xs text-white/30 font-medium uppercase tracking-widest mb-2">
                  Your shareable link
                </p>
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-dark-700/80 border border-white/8">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  <p className="text-sm text-white/55 font-mono truncate flex-1 select-all">
                    {profileUrl}
                  </p>
                </div>
              </div>

              {/* THE button */}
              <CopyButton url={profileUrl} />

              {/* Secondary actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => navigate(`/profile/${user.id}`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/25 transition-all"
                >
                  <ExternalLink size={14} />
                  View profile
                </button>
                <a
                  href={tweetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-white/25 transition-all flex-shrink-0"
                  title="Share on X"
                >
                  <Twitter size={15} />
                </a>
                <button
                  onClick={async () => {
                    if (navigator.share) {
                      try { await navigator.share({ url: profileUrl, title: `${displayName} on Remixr` }); } catch {}
                    }
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-white/25 transition-all flex-shrink-0"
                  title="Share"
                >
                  <Share2 size={15} />
                </button>
              </div>
            </div>

            {/* Upload another */}
            <p className="text-center text-xs text-white/20">
              <button
                onClick={() => navigate('/onboarding/upload')}
                className="hover:text-white/45 transition-colors underline underline-offset-2"
              >
                Upload another track
              </button>
            </p>
          </motion.div>
        </div>

      </div>
    </div>
  );
};

export default OnboardingLive;
