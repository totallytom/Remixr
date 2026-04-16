import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Camera, AtSign, ArrowRight, Check, X, Loader2,
  Mic2, Music2, Users,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import { getAvatarUrl } from '../utils/avatar';

const GENRES = [
  'Electronic', 'Pop', 'Rock', 'Hip Hop', 'R&B', 'Jazz', 'Classical',
  'Country', 'Folk', 'Alternative', 'Experimental', 'Reggae', 'Blues',
];
const MAX_GENRES = 3;
const HANDLE_RE = /^[a-zA-Z0-9_]{3,24}$/;

type HandleStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

// ─── Live profile preview ────────────────────────────────────────────────────
const ProfilePreview: React.FC<{
  avatarPreview: string | null;
  displayName: string;
  handle: string;
  bio: string;
  genres: string[];
}> = ({ avatarPreview, displayName, handle, bio, genres }) => {
  const name = displayName.trim() || 'Your Name';
  const slug = handle.trim() || 'yourhandle';

  return (
    <div className="relative">
      {/* Label */}
      <p className="text-xs font-medium text-white/30 uppercase tracking-widest mb-3 text-center">
        Public profile preview
      </p>

      {/* Card */}
      <div className="glass-effect rounded-2xl overflow-hidden">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-br from-violet-600/40 via-primary-600/30 to-fuchsia-600/40" />

        {/* Avatar + identity */}
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <div className="w-20 h-20 rounded-full border-4 border-dark-800 overflow-hidden bg-dark-700 flex-shrink-0">
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Mic2 size={28} className="text-dark-500" />
                </div>
              )}
            </div>
            <div className="pb-1 min-w-0">
              <h3 className="font-bold text-white truncate" style={{ fontSize: '1.1rem' }}>{name}</h3>
              <p className="text-sm text-white/40">@{slug}</p>
            </div>
          </div>

          {/* Bio */}
          {bio.trim() ? (
            <p className="text-sm text-white/60 mb-4 line-clamp-3">{bio}</p>
          ) : (
            <p className="text-sm text-white/20 italic mb-4">Your bio will appear here</p>
          )}

          {/* Genre tags */}
          {genres.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {genres.map(g => (
                <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-primary-500/15 text-primary-300 border border-primary-500/20">
                  {g}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex gap-1.5">
              {['Genre', 'Tags'].map(g => (
                <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-dark-700 text-dark-500 border border-dark-600">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Stub stats */}
          <div className="flex gap-5 mt-5 pt-4 border-t border-white/5">
            {[['0', 'Tracks'], ['0', 'Followers'], ['0', 'Following']].map(([n, l]) => (
              <div key={l} className="text-center">
                <p className="text-sm font-bold text-white">{n}</p>
                <p className="text-[10px] text-white/30">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Shareable URL hint */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        <div className="h-px flex-1 bg-white/5" />
        <p className="text-[10px] text-white/25 px-2">remixr.app/@{slug}</p>
        <div className="h-px flex-1 bg-white/5" />
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const Onboarding: React.FC = () => {
  const { user, isAuthenticated, updateProfile, setUserAvatar } = useStore();
  const navigate = useNavigate();

  // Redirect non-auth users; redirect listeners away from the musician flow
  useEffect(() => {
    if (user) {
      if (user.role !== 'musician') navigate('/');
      return;
    }
    if (!isAuthenticated) {
      const timer = setTimeout(() => navigate('/signup'), 8000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, navigate]);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [handleStatus, setHandleStatus] = useState<HandleStatus>('idle');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const handleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-populate from store once user is available
  useEffect(() => {
    if (user) {
      setHandle(user.username || '');
      setDisplayName(user.artistName || '');
      setAvatarPreview(user.avatar && user.avatar !== '/default-avatar.jpg' ? user.avatar : null);
    }
  }, [user?.id]);

  // ── Avatar pick ──────────────────────────────────────────────────────────
  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5 MB.'); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError('');
  };

  // ── Handle validation + uniqueness check ─────────────────────────────────
  const checkHandle = useCallback(async (value: string) => {
    if (!HANDLE_RE.test(value)) {
      setHandleStatus('invalid');
      return;
    }
    // Skip DB check if unchanged from current username
    if (user && value === user.username) {
      setHandleStatus('available');
      return;
    }
    setHandleStatus('checking');
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('username', value)
      .maybeSingle();
    setHandleStatus(data ? 'taken' : 'available');
  }, [user]);

  const onHandleChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setHandle(sanitized);
    setHandleStatus('idle');
    if (handleDebounceRef.current) clearTimeout(handleDebounceRef.current);
    if (sanitized.length >= 3) {
      handleDebounceRef.current = setTimeout(() => checkHandle(sanitized), 500);
    }
  };

  // ── Genre toggle ─────────────────────────────────────────────────────────
  const toggleGenre = (g: string) => {
    setGenres(prev =>
      prev.includes(g)
        ? prev.filter(x => x !== g)
        : prev.length < MAX_GENRES ? [...prev, g] : prev
    );
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!displayName.trim()) { setError('Display name is required.'); return; }
    if (handleStatus === 'taken') { setError('That handle is taken — choose another.'); return; }
    if (handleStatus === 'invalid' || !HANDLE_RE.test(handle)) {
      setError('Handle must be 3–24 characters: letters, numbers, underscores only.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      let avatarUrl = user.avatar;

      // Upload new avatar if chosen
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() || 'jpg';
        const path = `avatars/${user.id}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('music-files')
          .upload(path, avatarFile, { contentType: avatarFile.type, upsert: true });
        if (uploadErr) throw new Error(uploadErr.message);
        avatarUrl = supabase.storage.from('music-files').getPublicUrl(uploadData.path).data.publicUrl;
        setUserAvatar(avatarUrl);
      }

      await updateProfile({
        artistName: displayName.trim(),
        username: handle,
        bio: bio.trim(),
        genres,
        ...(avatarUrl ? { avatar: avatarUrl } : {}),
      });

      sessionStorage.removeItem('signup_role');
      navigate('/onboarding/upload');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Handle status icon ────────────────────────────────────────────────────
  const HandleIcon = () => {
    if (handleStatus === 'checking') return <Loader2 size={14} className="animate-spin text-white/40" />;
    if (handleStatus === 'available') return <Check size={14} className="text-emerald-400" />;
    if (handleStatus === 'taken') return <X size={14} className="text-red-400" />;
    return null;
  };

  // ── Loading state while auth resolves ────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white/40">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm">Setting up your account…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900 p-4 py-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 mb-4">
            <Music2 size={12} className="text-violet-400" />
            <span className="text-xs text-violet-300 font-medium">Step 2 of 3 · Build your identity</span>
          </div>
          <h1 className="h2 text-gradient-neon mb-2">Set up your artist profile</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            This becomes your public page. Takes 60 seconds.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">

          {/* ── Form ── */}
          <motion.form
            onSubmit={onSubmit}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-effect rounded-2xl p-8 space-y-7"
          >
            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key="err"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-3 bg-red-500/10 border border-red-500/25 rounded-lg"
                >
                  <p className="text-sm text-red-400">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Avatar */}
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full bg-dark-700 border-2 border-dashed border-dark-500 hover:border-primary-500 flex items-center justify-center overflow-hidden transition-colors group flex-shrink-0"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <Mic2 size={24} className="text-dark-500 group-hover:text-primary-400 transition-colors" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={18} className="text-white" />
                </div>
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
              <div>
                <p className="text-sm font-medium text-white">Profile photo</p>
                <p className="text-xs text-white/40 mt-0.5">Optional · JPG, PNG, WebP · Max 5 MB</p>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={() => { setAvatarPreview(null); setAvatarFile(null); }}
                    className="text-xs text-red-400 hover:text-red-300 mt-1 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Display name */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Display name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your artist or stage name"
                maxLength={60}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Handle */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Handle <span className="text-red-400">*</span>
                <span className="ml-2 text-xs font-normal text-white/30">· your URL: remixr.app/@handle</span>
              </label>
              <div className="relative">
                <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
                <input
                  type="text"
                  value={handle}
                  onChange={e => onHandleChange(e.target.value)}
                  placeholder="yourhandle"
                  maxLength={24}
                  className={`w-full pl-9 pr-9 py-3 bg-dark-700 border rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                    handleStatus === 'taken'
                      ? 'border-red-500/60 focus:ring-red-500'
                      : handleStatus === 'available'
                      ? 'border-emerald-500/60 focus:ring-emerald-500'
                      : 'border-dark-600 focus:ring-primary-500'
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <HandleIcon />
                </div>
              </div>
              <div className="mt-1 flex justify-between">
                <p className={`text-xs ${handleStatus === 'taken' ? 'text-red-400' : handleStatus === 'available' ? 'text-emerald-400' : handleStatus === 'invalid' ? 'text-red-400' : 'text-white/0'}`}>
                  {handleStatus === 'taken' && 'Handle already taken'}
                  {handleStatus === 'available' && 'Handle is available'}
                  {handleStatus === 'invalid' && '3–24 chars · letters, numbers, underscores'}
                  {(handleStatus === 'idle' || handleStatus === 'checking') && '.'}
                </p>
                <p className="text-xs text-white/25">{handle.length}/24</p>
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Bio
                <span className="ml-2 text-xs font-normal text-white/30">· optional</span>
              </label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="One or two lines about your sound…"
                rows={3}
                maxLength={200}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
              />
              <p className="text-xs text-white/25 text-right mt-1">{bio.length}/200</p>
            </div>

            {/* Genres */}
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Genres
                <span className="ml-2 text-xs font-normal text-white/30">· pick up to {MAX_GENRES}</span>
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {GENRES.map(g => {
                  const selected = genres.includes(g);
                  const disabled = !selected && genres.length >= MAX_GENRES;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGenre(g)}
                      disabled={disabled}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        selected
                          ? 'border-primary-500 bg-primary-500/15 text-primary-300'
                          : disabled
                          ? 'border-dark-700 text-dark-600 cursor-not-allowed'
                          : 'border-dark-600 text-dark-300 hover:border-dark-400 hover:text-white'
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isSaving || handleStatus === 'taken' || handleStatus === 'checking'}
              whileHover={{ scale: isSaving ? 1 : 1.02 }}
              whileTap={{ scale: isSaving ? 1 : 0.98 }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-secondary-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-primary-700 hover:to-secondary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <><Loader2 size={16} className="animate-spin" /> Saving…</>
              ) : (
                <>Save & upload your first track <ArrowRight size={16} /></>
              )}
            </motion.button>

            {/* Skip */}
            <p className="text-center text-xs text-white/25">
              <button
                type="button"
                onClick={() => navigate('/onboarding/upload')}
                className="hover:text-white/50 transition-colors underline underline-offset-2"
              >
                Skip for now
              </button>
            </p>
          </motion.form>

          {/* ── Live preview ── */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:sticky lg:top-8"
          >
            <ProfilePreview
              avatarPreview={avatarPreview}
              displayName={displayName}
              handle={handle}
              bio={bio}
              genres={genres}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
