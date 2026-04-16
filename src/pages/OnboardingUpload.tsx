import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud, Music2, X, Globe, ArrowRight,
  Disc3, Mic2, Loader2, Image as ImageIcon,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAlerts } from '../contexts/AlertContext';
import { supabase } from '../services/supabase';
import { checkCopyright } from '../services/copyrightService';
import { transcodeWavOrAiffToM4a, shouldTranscodeToM4a } from '../utils/transcodeAudio';

// ─── Constants ─────────────────────────────────────────────────────────────
const GENRES = [
  'Electronic', 'Pop', 'Rock', 'Hip Hop', 'R&B', 'Jazz', 'Classical',
  'Country', 'Folk', 'Alternative', 'Experimental', 'Reggae', 'Blues',
];
const ACCEPTED = ['.mp3', '.wav', '.aiff', '.aif', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aiff', 'audio/x-aiff'];
const MAX_MB = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isAudio(f: File) {
  const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
  return ACCEPTED.some(t => t === ext || t === f.type);
}
function audioContentType(f: File) {
  if (f.type) return f.type;
  const ext = f.name.split('.').pop()?.toLowerCase();
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'm4a') return 'audio/mp4';
  return 'audio/mpeg';
}
function imageContentType(f: File) {
  if (f.type?.startsWith('image/')) return f.type;
  const ext = f.name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}
function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = URL.createObjectURL(file);
    audio.onloadedmetadata = () => { URL.revokeObjectURL(audio.src); resolve(Math.floor(audio.duration)); };
    audio.onerror = () => resolve(0);
  });
}
function fmtDuration(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}
function fileSizeMB(f: File) {
  return (f.size / (1024 * 1024)).toFixed(1);
}

type ReleaseType = 'single' | 'album';

interface TrackFile { file: File; title: string; duration: number; order: number; }

// ─── Drop zone ────────────────────────────────────────────────────────────────
const DropZone: React.FC<{
  files: TrackFile[];
  isDragging: boolean;
  isTranscoding: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onClick: () => void;
  onRemove: (i: number) => void;
}> = ({ files, isDragging, isTranscoding, onDrop, onDragOver, onDragLeave, onClick, onRemove }) => {
  const hasFiles = files.length > 0;

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`rounded-2xl border-2 border-dashed transition-all ${
        isDragging
          ? 'border-primary-400 bg-primary-500/10 scale-[1.01]'
          : hasFiles
          ? 'border-dark-600 bg-dark-800/50'
          : 'border-dark-600 hover:border-primary-500/60 bg-dark-800/30 hover:bg-dark-800/50'
      }`}
    >
      {!hasFiles ? (
        /* Empty state */
        <button
          type="button"
          onClick={onClick}
          disabled={isTranscoding}
          className="w-full p-12 flex flex-col items-center gap-4 focus:outline-none"
        >
          <motion.div
            animate={isDragging ? { scale: 1.15, rotate: -6 } : { scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260 }}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              isDragging ? 'bg-primary-500/20' : 'bg-dark-700'
            }`}
          >
            <UploadCloud size={28} className={isDragging ? 'text-primary-400' : 'text-dark-400'} />
          </motion.div>
          <div className="text-center">
            <p className="font-semibold text-white mb-1">
              {isDragging ? 'Release to add' : 'Drop your track here'}
            </p>
            <p className="text-sm text-white/40">
              MP3, WAV, AIFF · Max {MAX_MB} MB
            </p>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-full bg-dark-700 text-white/50">
            or click to browse
          </span>
        </button>
      ) : (
        /* Files loaded */
        <div className="p-4 space-y-2">
          {files.map((t, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-dark-700/60">
              <div className="w-8 h-8 rounded-lg bg-primary-500/15 flex items-center justify-center flex-shrink-0">
                <Music2 size={14} className="text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{t.file.name}</p>
                <p className="text-xs text-white/35">
                  {t.duration ? fmtDuration(t.duration) : '—'} · {fileSizeMB(t.file)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-dark-400 hover:text-red-400 transition-colors p-1"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {/* Add more (album only) */}
          <button
            type="button"
            onClick={onClick}
            disabled={isTranscoding}
            className="w-full py-2 text-xs text-white/30 hover:text-white/60 transition-colors flex items-center justify-center gap-1.5"
          >
            <UploadCloud size={12} />
            {isTranscoding ? 'Converting…' : 'Add more tracks'}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const OnboardingUpload: React.FC = () => {
  const { user, isAuthenticated } = useStore();
  const { addAlert } = useAlerts();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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

  // ── File state ─────────────────────────────────────────────────────────────
  const [files, setFiles] = useState<TrackFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [dropError, setDropError] = useState('');

  // ── Metadata ───────────────────────────────────────────────────────────────
  const [releaseType, setReleaseType] = useState<ReleaseType>('single');
  const [trackTitle, setTrackTitle] = useState('');
  const [albumTitle, setAlbumTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // ── Upload state ───────────────────────────────────────────────────────────
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  const hasFiles = files.length > 0;
  const isAlbumMode = releaseType === 'album';

  // Auto-set release type when files are added
  useEffect(() => {
    if (files.length > 1) setReleaseType('album');
  }, [files.length]);

  // ── Process dropped / selected files ──────────────────────────────────────
  const processFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList?.length || isTranscoding) return;
    setDropError('');
    const valid = Array.from(fileList).filter(isAudio);
    if (!valid.length) { setDropError('Only MP3, WAV, and AIFF files are supported.'); return; }
    const tooBig = valid.filter(f => f.size > MAX_MB * 1024 * 1024);
    if (tooBig.length) { setDropError(`Files must be under ${MAX_MB} MB each.`); return; }

    const needsTranscode = valid.some(shouldTranscodeToM4a);
    if (needsTranscode) setIsTranscoding(true);

    try {
      const ready = await Promise.all(valid.map(f => shouldTranscodeToM4a(f) ? transcodeWavOrAiffToM4a(f) : Promise.resolve(f)));
      const newEntries: TrackFile[] = ready.map((f, i) => ({
        file: f,
        title: f.name.replace(/\.[^.]+$/, ''),
        duration: 0,
        order: files.length + i + 1,
      }));

      // Pre-populate title for single
      if (files.length === 0 && newEntries.length === 1) {
        setTrackTitle(newEntries[0].title);
      }

      setFiles(prev => [...prev, ...newEntries]);

      // Load durations in background
      newEntries.forEach(async (e, idx) => {
        const dur = await getAudioDuration(e.file);
        setFiles(prev => prev.map(t => t.file === e.file ? { ...t, duration: dur } : t));
      });
    } catch (err) {
      setDropError(err instanceof Error ? err.message : 'Conversion failed.');
    } finally {
      setIsTranscoding(false);
    }
  }, [files.length, isTranscoding]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { processFiles(e.target.files); e.target.value = ''; };
  const removeFile = (i: number) => {
    setFiles(prev => {
      const next = prev.filter((_, idx) => idx !== i).map((t, idx) => ({ ...t, order: idx + 1 }));
      if (next.length === 0) { setTrackTitle(''); setAlbumTitle(''); }
      if (next.length <= 1) setReleaseType('single');
      return next;
    });
  };

  // ── Cover ──────────────────────────────────────────────────────────────────
  const onCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setDropError('Cover must be an image file.'); return; }
    if (f.size > 10 * 1024 * 1024) { setDropError('Cover must be under 10 MB.'); return; }
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
    setDropError('');
  };

  // ── Upload ──────────────────────────────────────────────────────────────────
  const canSubmit = hasFiles && trackTitle.trim() && genre && (!isAlbumMode || albumTitle.trim());

  const handleUpload = async () => {
    if (!user || !canSubmit) return;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError('');

    const tick = setInterval(() => setUploadProgress(p => p >= 85 ? 85 : p + 8), 300);

    try {
      if (releaseType === 'single') {
        const track = files[0];

        // Copyright pre-check
        try {
          const r = await checkCopyright(track.file, { title: trackTitle, artist: user.artistName || user.username });
          if (r.blocked) { addAlert(r.reason || 'Blocked by copyright policy.', 'error', 'Copyright'); return; }
        } catch { /* proceed if check unavailable */ }

        // Upload audio
        const sanitized = track.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const audioPath = `audio-files/${user.id}/${Date.now()}-${sanitized}`;
        const { data: audioData, error: audioErr } = await supabase.storage
          .from('music-files')
          .upload(audioPath, track.file, { contentType: audioContentType(track.file), upsert: false });
        if (audioErr || !audioData?.path) throw new Error(audioErr?.message || 'Audio upload failed');

        // ACRCloud check
        try {
          const { data: acrData } = await supabase.functions.invoke('check-copyright-acr', {
            body: { bucket: 'music-files', path: audioData.path },
          });
          if (acrData?.copyrighted) {
            addAlert(acrData.reason || 'Matches a copyrighted recording.', 'error', 'Copyright');
            setIsUploading(false); clearInterval(tick); return;
          }
        } catch { /* allow upload if edge function unavailable */ }

        const audioUrl = supabase.storage.from('music-files').getPublicUrl(audioData.path).data.publicUrl;

        // Upload cover
        let coverUrl = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';
        if (coverFile) {
          const coverSanitized = coverFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const coverPath = `playlist-covers/${user.id}/${Date.now()}-${coverSanitized}`;
          const { data: coverData, error: coverErr } = await supabase.storage
            .from('music-files')
            .upload(coverPath, coverFile, { contentType: imageContentType(coverFile), upsert: false });
          if (coverErr || !coverData?.path) throw new Error(coverErr?.message || 'Cover upload failed');
          coverUrl = supabase.storage.from('music-files').getPublicUrl(coverData.path).data.publicUrl;
        }

        // Insert track
        const { error: trackErr } = await supabase.from('tracks').insert({
          title: trackTitle.trim(),
          artist: user.artistName || user.username,
          duration: track.duration,
          cover: coverUrl,
          audio_url: audioUrl,
          genre,
          user_id: user.id,
          preview_start_sec: 0,
          preview_duration_sec: 20,
        });
        if (trackErr) throw new Error(trackErr.message);

      } else {
        /* Album path */
        if (!coverFile) { setUploadError('A cover image is required for albums.'); setIsUploading(false); clearInterval(tick); return; }

        const coverSanitized = coverFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const coverPath = `playlist-covers/${user.id}/${Date.now()}-${coverSanitized}`;
        const { data: coverData, error: coverErr } = await supabase.storage
          .from('music-files')
          .upload(coverPath, coverFile, { contentType: imageContentType(coverFile), upsert: false });
        if (coverErr || !coverData?.path) throw new Error(coverErr?.message || 'Cover upload failed');
        const coverUrl = supabase.storage.from('music-files').getPublicUrl(coverData.path).data.publicUrl;

        const uploadedTracks: { title: string; duration: number; audio_url: string; order: number; storage_path: string }[] = [];
        for (let i = 0; i < files.length; i++) {
          const t = files[i];
          const san = t.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const p = `audio-files/${user.id}/${Date.now()}-${i}-${san}`;
          const { data: ad, error: ae } = await supabase.storage
            .from('music-files')
            .upload(p, t.file, { contentType: audioContentType(t.file), upsert: false });
          if (ae || !ad?.path) throw new Error(`Track ${i + 1} failed: ${ae?.message}`);
          uploadedTracks.push({ title: t.title, duration: t.duration, audio_url: supabase.storage.from('music-files').getPublicUrl(ad.path).data.publicUrl, order: t.order, storage_path: ad.path });
          setUploadProgress(20 + ((i + 1) / files.length) * 55);
        }

        const { data: albumData, error: albumErr } = await supabase
          .from('albums')
          .insert({ title: albumTitle.trim(), artist: user.artistName || user.username, cover: coverUrl, genre, user_id: user.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .select().single();
        if (albumErr) throw new Error(albumErr.message);

        const { error: tracksErr } = await supabase.from('tracks').insert(
          uploadedTracks.map(t => ({
            title: t.title, artist: user.artistName || user.username, album: albumTitle.trim(),
            duration: t.duration, cover: coverUrl, audio_url: t.audio_url, genre, user_id: user.id,
            album_id: albumData.id, preview_start_sec: 0, preview_duration_sec: 20,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }))
        );
        if (tracksErr) throw new Error(tracksErr.message);
      }

      clearInterval(tick);
      setUploadProgress(100);

      navigate('/onboarding/live', {
        state: {
          track: {
            title: isAlbumMode ? albumTitle.trim() : trackTitle.trim(),
            cover: coverPreview,
            genre,
            releaseType,
          },
        },
      });

    } catch (err) {
      clearInterval(tick);
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const resetAll = () => {
    setFiles([]); setTrackTitle(''); setAlbumTitle(''); setGenre('');
    setCoverFile(null); setCoverPreview(null);
    setUploadError(''); setUploadProgress(0); setReleaseType('single');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white/40">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900 p-4 py-8">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 mb-4">
            <Mic2 size={12} className="text-violet-400" />
            <span className="text-xs text-violet-300 font-medium">Step 3 of 3 · Release your first track</span>
          </div>
          <h1 className="h2 text-gradient-neon mb-2">Upload your music</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Drop a file, fill in the details, hit publish.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

              {/* Hidden inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.aiff,.aif,audio/mpeg,audio/wav,audio/aiff,audio/x-aiff"
                multiple
                className="hidden"
                onChange={onFileChange}
              />
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={onCoverChange} />

              {/* Drop zone */}
              <DropZone
                files={files}
                isDragging={isDragging}
                isTranscoding={isTranscoding}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => fileInputRef.current?.click()}
                onRemove={removeFile}
              />

              {dropError && (
                <p className="text-sm text-red-400 px-1">{dropError}</p>
              )}

              {/* Metadata — slides in when files are ready */}
              <AnimatePresence>
                {hasFiles && (
                  <motion.div
                    key="meta"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="glass-effect rounded-2xl p-6 space-y-5"
                  >
                    {/* Release type */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-3">Release type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['single', 'album'] as ReleaseType[]).map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setReleaseType(type)}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                              releaseType === type
                                ? 'border-primary-500 bg-primary-500/10 text-white'
                                : 'border-dark-600 text-dark-400 hover:border-dark-500 hover:text-white'
                            }`}
                          >
                            {type === 'single' ? <Music2 size={15} /> : <Disc3 size={15} />}
                            {type === 'single' ? 'Single' : 'Album'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Track / album title */}
                    {isAlbumMode ? (
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Album title <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={albumTitle}
                          onChange={e => setAlbumTitle(e.target.value)}
                          placeholder="Album name"
                          maxLength={100}
                          className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Track title <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={trackTitle}
                          onChange={e => setTrackTitle(e.target.value)}
                          placeholder="Track name"
                          maxLength={100}
                          className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        />
                      </div>
                    )}

                    {/* Genre */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Genre <span className="text-red-400">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {GENRES.map(g => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setGenre(g)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                              genre === g
                                ? 'border-primary-500 bg-primary-500/15 text-primary-300'
                                : 'border-dark-600 text-dark-400 hover:border-dark-500 hover:text-white'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cover art */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Cover art
                        {isAlbumMode && <span className="text-red-400"> *</span>}
                        {!isAlbumMode && <span className="ml-1.5 text-xs font-normal text-white/30">· optional</span>}
                      </label>
                      {!coverPreview ? (
                        <button
                          type="button"
                          onClick={() => coverInputRef.current?.click()}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-dark-600 hover:border-dark-500 text-sm text-white/40 hover:text-white/70 transition-all"
                        >
                          <ImageIcon size={16} />
                          {isAlbumMode ? 'Add album cover' : 'Add cover art'}
                        </button>
                      ) : (
                        <div className="flex items-center gap-3">
                          <img
                            src={coverPreview}
                            alt="cover"
                            className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{coverFile?.name}</p>
                            <button
                              type="button"
                              onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors mt-0.5"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Upload error */}
                    <AnimatePresence>
                      {uploadError && (
                        <motion.p
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="text-sm text-red-400"
                        >
                          {uploadError}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {/* Progress bar */}
                    {isUploading && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-white/40">
                          <span>Uploading…</span><span>{uploadProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full"
                            animate={{ width: `${uploadProgress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Public note + submit */}
                    <div className="pt-2 space-y-3">
                      {/* The key UX note */}
                      <div className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                        <Globe size={13} className="text-emerald-400 flex-shrink-0" />
                        <p className="text-xs text-emerald-300/80 font-medium">
                          Your track is public immediately.
                        </p>
                      </div>

                      <motion.button
                        type="button"
                        onClick={handleUpload}
                        disabled={isUploading || !canSubmit}
                        whileHover={{ scale: isUploading || !canSubmit ? 1 : 1.02 }}
                        whileTap={{ scale: isUploading || !canSubmit ? 1 : 0.98 }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {isUploading ? (
                          <><Loader2 size={16} className="animate-spin" /> Publishing…</>
                        ) : (
                          <>Publish <ArrowRight size={16} /></>
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Skip */}
              {!hasFiles && (
                <p className="text-center text-xs text-white/20 mt-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/profile/${user.id}`)}
                    className="hover:text-white/45 transition-colors underline underline-offset-2"
                  >
                    Skip for now — go to my profile
                  </button>
                </p>
              )}

            </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OnboardingUpload;
