import React, { useState, useRef, useEffect } from 'react';
import { motion, Reorder } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Music,
  X,
  Play,
  Pause,
  Save,
  Image as ImageIcon,
  Lock,
  CloudUpload,
  ChevronRight,
  ChevronLeft,
  GripVertical,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAlerts } from '../contexts/AlertContext';
import { supabase } from '../services/supabase';
import { requestUploadToken, confirmUpload } from '../services/api';
import { DOWNLOAD_POLICY_OPTIONS, type DownloadPolicy } from '../services/downloadService';
import { LICENSES, licenseInfo, DEFAULT_LICENSE, type LicenseType } from '../config/licenses';
import dinoImg from '../../public/logo/DINO.png';
import littlePrinceImg from '../../public/logo/LITTLE PRINCE.png';
import { SnippetEditor } from '../components/music/SnippetEditor';
import { transcodeWavOrAiffToM4a, shouldTranscodeToM4a } from '../utils/transcodeAudio';
import { analyticsService } from '../services/analyticsService';

const GENRES = [
  'Electronic', 'Pop', 'Rock', 'Hip Hop', 'R&B', 'Jazz', 'Classical',
  'Country', 'Folk', 'Alternative', 'Experimental', 'Reggae', 'Blues',
];

const ACCEPTED_AUDIO = ['.mp3', '.wav', '.aiff', '.aif', '.m4a', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aiff', 'audio/x-aiff', 'audio/mp4', 'audio/x-m4a'];
const MAX_FILE_MB = 50;
const MAX_TRACKS = 20;
const FREE_TRACK_LIMIT = 10;
const FREE_ALBUM_LIMIT = 2;

const getAudioDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = URL.createObjectURL(file);
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(Math.floor(audio.duration));
    };
    audio.onerror = () => reject(new Error('Failed to load audio for duration.'));
  });
};

function isAcceptedAudio(file: File): boolean {
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  return ACCEPTED_AUDIO.some(t => t === ext || t === file.type);
}

function getAudioContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'm4a') return 'audio/mp4';
  return 'audio/mpeg';
}

function getImageContentType(file: File): string {
  if (file.type?.startsWith('image/')) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Extract first ~400 KB of audio as base64 for Audd.io fingerprinting
async function extractSample(file: File): Promise<string> {
  return new Promise((resolve) => {
    const slice = file.slice(0, 400 * 1024);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(slice);
  });
}


export interface TrackEntry {
  id: string;
  file: File;
  title: string;
  duration: number;
  order: number;
  previewStartSec?: number;
  previewDurationSec?: number;
}

function createTrackEntry(file: File, order: number): TrackEntry {
  const baseName = file.name.replace(/\.[^.]+$/, '') || `Track ${order}`;
  return {
    id: crypto.randomUUID?.() ?? `track-${Date.now()}-${order}`,
    file,
    title: baseName,
    duration: 0,
    order,
    previewStartSec: 0,
    previewDurationSec: 20,
  };
}

// Unified Upload Content: single dropzone, 1 file = single track, 2+ = album
const UnifiedUploadContent: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useStore();
  const { addAlert } = useAlerts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [tracks, setTracks] = useState<TrackEntry[]>([]);
  const [albumTitle, setAlbumTitle] = useState('');
  const [artist, setArtist] = useState(user?.username || '');
  const [genre, setGenre] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [singleTitle, setSingleTitle] = useState('');
  const [singleAlbumName, setSingleAlbumName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dropError, setDropError] = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [previewStartSec, setPreviewStartSec] = useState(0);
  const [previewDurationSec, setPreviewDurationSec] = useState(20);
  const [downloadPolicy, setDownloadPolicy] = useState<DownloadPolicy>('off');
  const [licenseType, setLicenseType] = useState<LicenseType>(DEFAULT_LICENSE);
  const [trackObjectUrls, setTrackObjectUrls] = useState<Record<string, string>>({});
  const trackUrlsForCleanupRef = useRef<Record<string, string>>({});
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [uploadCounts, setUploadCounts] = useState<{ trackCount: number; albumCount: number } | null>(null);

  const isPro = user?.subscriptionTier === 'artist';
  const atTrackLimit = !isPro && (uploadCounts?.trackCount ?? 0) >= FREE_TRACK_LIMIT;
  const atAlbumLimit = !isPro && (uploadCounts?.albumCount ?? 0) >= FREE_ALBUM_LIMIT;

  useEffect(() => {
    if (!user?.id) return;
    analyticsService.getUploadCounts(user.id).then(setUploadCounts).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    setArtist(user?.username || '');
  }, [user?.username]);

  // Create/revoke object URLs for album tracks so SnippetEditor can play audio
  useEffect(() => {
    if (tracks.length <= 1) {
      setTrackObjectUrls((prev) => {
        Object.values(prev).forEach(URL.revokeObjectURL);
        trackUrlsForCleanupRef.current = {};
        return {};
      });
      return;
    }
    const currentIds = new Set(tracks.map((t) => t.id));
    setTrackObjectUrls((prev) => {
      const next: Record<string, string> = {};
      tracks.forEach((t) => {
        next[t.id] = prev[t.id] ?? URL.createObjectURL(t.file);
      });
      Object.keys(prev).forEach((id) => {
        if (!currentIds.has(id)) URL.revokeObjectURL(prev[id]);
      });
      trackUrlsForCleanupRef.current = next;
      return next;
    });
  }, [tracks]);

  useEffect(() => {
    return () => {
      Object.values(trackUrlsForCleanupRef.current).forEach(URL.revokeObjectURL);
      trackUrlsForCleanupRef.current = {};
    };
  }, []);

  const setTrackPreview = (id: string, startSec: number, durationSec: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, previewStartSec: startSec, previewDurationSec: durationSec } : t))
    );
  };

  useEffect(() => {
    if (!expandedImage) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedImage(null); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [expandedImage]);

  const processFiles = async (fileList: FileList | null) => {
    if (!fileList?.length || isTranscoding) return;
    setDropError(null);
    const files = Array.from(fileList).filter(isAcceptedAudio);
    if (files.length === 0) {
      setDropError('Only MP3, WAV, and AIFF (e.g. GarageBand) files are supported.');
      return;
    }
    const maxBytes = MAX_FILE_MB * 1024 * 1024;
    const tooBig = files.filter(f => f.size > maxBytes);
    if (tooBig.length) {
      setDropError(`Some files exceed ${MAX_FILE_MB} MB.`);
      return;
    }
    if (tracks.length + files.length > MAX_TRACKS) {
      setDropError(`Maximum ${MAX_TRACKS} tracks per upload allowed.`);
      return;
    }
    if (!isPro) {
      const alreadyUploaded = uploadCounts?.trackCount ?? 0;
      const wouldTotal = alreadyUploaded + tracks.length + files.length;
      if (wouldTotal > FREE_TRACK_LIMIT) {
        const remaining = Math.max(0, FREE_TRACK_LIMIT - alreadyUploaded - tracks.length);
        setDropError(
          remaining === 0
            ? `You've reached the free plan limit of ${FREE_TRACK_LIMIT} tracks. Upgrade to Pro for unlimited uploads.`
            : `Adding these files would exceed your free plan limit. You can add ${remaining} more track${remaining === 1 ? '' : 's'}.`
        );
        return;
      }
    }
    const needsTranscode = files.some(shouldTranscodeToM4a);
    if (needsTranscode) setIsTranscoding(true);
    try {
      const filesToAdd: File[] = await Promise.all(
        files.map((file) => (shouldTranscodeToM4a(file) ? transcodeWavOrAiffToM4a(file) : Promise.resolve(file)))
      );
      const nextOrder = tracks.length + 1;
      const newEntries: TrackEntry[] = filesToAdd.map((file, i) => createTrackEntry(file, nextOrder + i));
    const combined = tracks.length ? [...tracks, ...newEntries] : newEntries;
      if (combined.length === 1) {
        setTracks(combined);
        setSingleTitle(combined[0].title);
        setAudioPreview(URL.createObjectURL(combined[0].file));
        Promise.resolve(getAudioDuration(combined[0].file)).then(dur =>
          setTracks(prev => prev.map(t => t.id === combined[0].id ? { ...t, duration: dur } : t))
        );
      } else {
        setTracks(combined);
        const withDurations = await Promise.all(
          newEntries.map(async (e) => ({ ...e, duration: await getAudioDuration(e.file).catch(() => 0) }))
        );
        setTracks(prev => {
          const byId = new Map(prev.map(t => [t.id, t]));
          withDurations.forEach(w => byId.set(w.id, w));
          return Array.from(byId.values()).sort((a, b) => a.order - b.order);
        });
      }
    } catch (err) {
      setDropError(err instanceof Error ? err.message : 'Conversion failed. Try MP3 or a smaller WAV.');
    } finally {
      setIsTranscoding(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    processFiles(e.dataTransfer.files);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const removeTrack = (id: string) => {
    const next = tracks.filter(t => t.id !== id);
    if (next.length === 0) {
      setTracks([]);
      setSingleTitle('');
      setAlbumTitle('');
      setAudioPreview(null);
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      setTracks(next.map((t, i) => ({ ...t, order: i + 1 })));
    }
  };
  const clearAll = () => {
    setTracks([]);
    setAlbumTitle('');
    setSingleTitle('');
    setSingleAlbumName('');
    setCoverImage(null);
    setAudioPreview(null);
    setPreviewStartSec(0);
    setPreviewDurationSec(20);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    setDropError(null);
  };

  const setTrackTitle = (id: string, title: string) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, title } : t));
  };
  const isSingle = tracks.length === 1;
  const isAlbum = tracks.length > 1;
  const inputBase = 'w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors';

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const submitSingle = async () => {
    if (!user) return;
    if (tracks.length !== 1) return;
    if (!isPro && (uploadCounts?.trackCount ?? 0) >= FREE_TRACK_LIMIT) {
      addAlert(`Free plan is limited to ${FREE_TRACK_LIMIT} tracks. Upgrade to Pro for unlimited uploads.`, 'warning', 'Upload limit reached');
      return;
    }
    if (!singleTitle.trim() || !artist.trim() || !genre) {
      addAlert('Please fill in Title, Artist, and Genre.', 'warning');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { addAlert('Session expired. Please log in again.', 'error'); return; }

    setIsUploading(true);
    setUploadProgress(0);
    const uploadInterval = setInterval(() => setUploadProgress(p => p >= 85 ? 85 : p + 8), 250);

    try {
      const selectedFile = tracks[0].file;

      // Step 1 — server copyright check + signed URL (blocks if copyrighted)
      const sampleBase64 = await extractSample(selectedFile);
      const { signedUrl, token: supabaseToken, path, uploadToken } = await requestUploadToken({
        title: singleTitle, artist,
        filename: selectedFile.name, fileSize: selectedFile.size,
        fileType: selectedFile.type || 'audio/mpeg', sampleBase64,
      });
      setUploadProgress(20);

      // Step 2 — upload audio via signed URL
      const { error: audioError } = await supabase.storage
        .from('music-files')
        .uploadToSignedUrl(path, supabaseToken, selectedFile, {
          contentType: getAudioContentType(selectedFile),
        });
      if (audioError) throw new Error(`Audio upload failed: ${audioError.message}`);
      setUploadProgress(60);

      // Step 3 — upload cover image directly (no copyright concern)
      let coverUrl = '';
      if (coverImage) {
        const sanitizedImageName = coverImage.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const coverPath = `playlist-covers/${user.id}/${Date.now()}-${sanitizedImageName}`;
        const { data: imgData, error: imgError } = await supabase.storage
          .from('music-files')
          .upload(coverPath, coverImage, { contentType: getImageContentType(coverImage), upsert: false });
        if (imgError || !imgData?.path) throw new Error(imgError?.message || 'Cover upload failed');
        coverUrl = supabase.storage.from('music-files').getPublicUrl(imgData.path).data.publicUrl;
      }
      setUploadProgress(75);

      // Step 4 — confirm upload: server inserts track row
      await confirmUpload({
        uploadToken,
        album: singleAlbumName,
        genre,
        duration: tracks[0]?.duration ?? 0,
        coverUrl,
        previewStartSec,
        previewDurationSec,
        downloadPolicy,
        licenseType,
      });

      clearInterval(uploadInterval);
      setUploadProgress(100);
      setIsUploading(false);
      addAlert('Your track is now live.', 'success', 'Track uploaded');
      clearAll();
      if (user?.id) analyticsService.getUploadCounts(user.id).then(setUploadCounts).catch(() => {});
    } catch (error) {
      clearInterval(uploadInterval);
      setIsUploading(false);
      addAlert(error instanceof Error ? error.message : 'Unknown error', 'error', 'Upload failed');
    }
  };

  const submitAlbum = async () => {
    if (!user || tracks.length < 2) return;
    if (!isPro) {
      if ((uploadCounts?.albumCount ?? 0) >= FREE_ALBUM_LIMIT) {
        addAlert(`Free plan is limited to ${FREE_ALBUM_LIMIT} albums. Upgrade to Pro for unlimited uploads.`, 'warning', 'Album limit reached');
        return;
      }
      const trackTotal = (uploadCounts?.trackCount ?? 0) + tracks.length;
      if (trackTotal > FREE_TRACK_LIMIT) {
        addAlert(`This album would bring your track total over the free plan limit of ${FREE_TRACK_LIMIT}. Upgrade to Pro for unlimited uploads.`, 'warning', 'Track limit reached');
        return;
      }
    }
    if (!albumTitle.trim() || !artist.trim() || !genre) {
      addAlert('Please fill in Album Title, Artist, and Genre.', 'warning');
      return;
    }
    if (!coverImage) {
      addAlert('Please upload an album cover.', 'warning');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { addAlert('Session expired. Please log in again.', 'error'); return; }

    setIsUploading(true);
    setUploadProgress(0);
    const uploadInterval = setInterval(() => setUploadProgress(p => p >= 85 ? 85 : p + 5), 300);

    try {
      // Step 1 — upload cover directly (not copyrightable)
      const sanitizedCoverName = coverImage.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const coverPath = `playlist-covers/${user.id}/${Date.now()}-${sanitizedCoverName}`;
      const { error: coverError } = await supabase.storage
        .from('music-files')
        .upload(coverPath, coverImage, { contentType: getImageContentType(coverImage), upsert: false });
      if (coverError) throw new Error(`Failed to upload cover: ${coverError.message}`);
      const coverUrl = supabase.storage.from('music-files').getPublicUrl(coverPath).data.publicUrl;
      setUploadProgress(10);

      // Step 2 — request signed URLs for each track (copyright checked per track)
      const sortedTracks = [...tracks].sort((a, b) => a.order - b.order);
      const signedTokens: { signedUrl: string; token: string; path: string; uploadToken: string }[] = [];
      for (let i = 0; i < sortedTracks.length; i++) {
        const sampleBase64 = await extractSample(sortedTracks[i].file);
        signedTokens[i] = await requestUploadToken({
          title: sortedTracks[i].title || albumTitle, artist,
          filename: sortedTracks[i].file.name, fileSize: sortedTracks[i].file.size,
          fileType: sortedTracks[i].file.type || 'audio/mpeg', sampleBase64,
        });
        setUploadProgress(10 + ((i + 1) / sortedTracks.length) * 20);
      }

      // Step 3 — upload each audio file via signed URL
      for (let i = 0; i < sortedTracks.length; i++) {
        const { error: uploadErr } = await supabase.storage
          .from('music-files')
          .uploadToSignedUrl(signedTokens[i].path, signedTokens[i].token, sortedTracks[i].file, { // token = Supabase signed token
            contentType: getAudioContentType(sortedTracks[i].file),
          });
        if (uploadErr) throw new Error(`Failed to upload track ${i + 1}: ${uploadErr.message}`);
        setUploadProgress(30 + ((i + 1) / sortedTracks.length) * 35);
      }

      // Step 4 — create album record (metadata only, no copyright concern)
      const { data: albumData, error: albumError } = await supabase
        .from('albums')
        .insert({
          title: albumTitle,
          artist,
          cover: coverUrl,
          genre,
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (albumError) throw new Error(`Failed to create album: ${albumError.message}`);
      setUploadProgress(70);

      // Step 5 — confirm each track (server inserts track rows)
      for (let i = 0; i < sortedTracks.length; i++) {
        await confirmUpload({
          uploadToken: signedTokens[i].uploadToken,
          album: albumTitle,
          genre,
          duration: sortedTracks[i].duration,
          coverUrl,
          albumId: albumData.id,
          previewStartSec: sortedTracks[i].previewStartSec ?? 0,
          previewDurationSec: sortedTracks[i].previewDurationSec ?? 20,
          downloadPolicy,
          licenseType,
        });
        setUploadProgress(70 + ((i + 1) / sortedTracks.length) * 28);
      }

      clearInterval(uploadInterval);
      setUploadProgress(100);
      setIsUploading(false);
      addAlert('Your album is now live.', 'success', 'Album uploaded');
      clearAll();
      if (user?.id) analyticsService.getUploadCounts(user.id).then(setUploadCounts).catch(() => {});
    } catch (error) {
      clearInterval(uploadInterval);
      setIsUploading(false);
      addAlert(error instanceof Error ? error.message : 'Failed to upload album', 'error', 'Upload failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Unified dropzone */}
        <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Drop files</h3>
            {!isPro && uploadCounts && (
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className={atTrackLimit ? 'text-amber-600 font-medium' : ''}>
                  {uploadCounts.trackCount}/{FREE_TRACK_LIMIT} tracks
                </span>
                <span className="text-gray-300">·</span>
                <span className={atAlbumLimit ? 'text-amber-600 font-medium' : ''}>
                  {uploadCounts.albumCount}/{FREE_ALBUM_LIMIT} albums
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/upgrade')}
                  className="text-violet-600 font-medium hover:underline"
                >
                  Go Pro →
                </button>
              </div>
            )}
          </div>

          {atTrackLimit ? (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-8 text-center">
              <Lock size={36} className="mx-auto mb-3 text-amber-500" />
              <p className="font-semibold text-gray-800 mb-1">Track limit reached</p>
              <p className="text-sm text-gray-600 mb-4">
                Free plan is capped at {FREE_TRACK_LIMIT} tracks. Upgrade to Pro for unlimited uploads.
              </p>
              <button
                type="button"
                onClick={() => navigate('/upgrade')}
                className="px-5 py-2 rounded-lg bg-violet-500 text-black text-sm font-medium hover:bg-violet-600 transition-colors"
              >
                Upgrade to Pro
              </button>
            </div>
          ) : (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors bg-gray-50/50 ${isTranscoding ? 'border-violet-300 opacity-80' : 'border-gray-300 hover:border-violet-400'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.aiff,.aif,.m4a,audio/mpeg,audio/wav,audio/aiff,audio/x-aiff,audio/mp4,audio/x-m4a"
                multiple
                onChange={onFileInputChange}
                className="hidden"
                disabled={isTranscoding}
              />
              <CloudUpload size={40} className="mx-auto mb-3 text-gray-400" />
              <p className="text-gray-700 font-medium mb-1">Select or drop audio files</p>
              <p className="text-gray-500 text-sm">
                MP3, WAV, AIFF, M4A · Max {MAX_FILE_MB}MB
                {!isPro && uploadCounts
                  ? ` · ${FREE_TRACK_LIMIT - uploadCounts.trackCount} track${FREE_TRACK_LIMIT - uploadCounts.trackCount === 1 ? '' : 's'} remaining`
                  : ` · Up to ${MAX_TRACKS} tracks`}
              </p>
              {isTranscoding ? (
                <p className="mt-3 text-violet-600 text-sm font-medium">Converting to M4A…</p>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 px-4 py-2 rounded-lg bg-violet-500 text-black text-sm font-medium hover:bg-violet-600 transition-colors"
                >
                  Select File
                </button>
              )}
            </div>
          )}
          {dropError && <p className="mt-2 text-sm text-red-600">{dropError}</p>}
          {tracks.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">{tracks.length} file(s) · Drop more to add, or clear below</p>
              <button type="button" onClick={clearAll} className="text-sm text-violet-600 hover:underline">Clear all</button>
            </div>
          )}
        </section>

        {/* Right: Empty | Single form | Album form */}
        <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-200 min-h-[200px]">
          {tracks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
              <Music size={48} className="mb-3 text-gray-300" />
              <p className="font-medium text-gray-700">No files yet</p>
              <p className="text-sm">Drop or select MP3, WAV, AIFF, or M4A (GarageBand) on the left to get started.</p>
            </div>
          )}

          {isSingle && (
            <div className="space-y-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Single track</h3>
              <div className="rounded-xl bg-gray-50 p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Music size={20} className="text-violet-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{tracks[0].file.name}</p>
                    <p className="text-sm text-gray-500">{formatDuration(tracks[0].duration)}</p>
                  </div>
                </div>
                {audioPreview && (
                  <>
                    <button type="button" onClick={handlePlayPause} className="p-2 rounded-lg bg-violet-500 text-black hover:bg-violet-600">
                      {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <audio ref={audioRef} src={audioPreview} onEnded={() => setIsPlaying(false)} />
                  </>
                )}
                <button type="button" onClick={() => removeTrack(tracks[0].id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50" aria-label="Remove"><X size={18} /></button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" value={singleTitle} onChange={(e) => { setSingleTitle(e.target.value); setTrackTitle(tracks[0].id, e.target.value); }} className={inputBase} placeholder="Track title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Artist *</label>
                <input type="text" value={artist} onChange={(e) => setArtist(e.target.value)} className={inputBase} placeholder="Artist" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Album</label>
                <input type="text" value={singleAlbumName} onChange={(e) => setSingleAlbumName(e.target.value)} className={inputBase} placeholder="Album name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Genre *</label>
                <select value={genre} onChange={(e) => setGenre(e.target.value)} className={inputBase}>
                  <option value="">Select genre</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Downloads</label>
                <select value={downloadPolicy} onChange={(e) => setDownloadPolicy(e.target.value as DownloadPolicy)} className={inputBase}>
                  {DOWNLOAD_POLICY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">{DOWNLOAD_POLICY_OPTIONS.find(o => o.value === downloadPolicy)?.detail} You can change this later from the track's menu.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Licence</label>
                <select value={licenseType} onChange={(e) => setLicenseType(e.target.value as LicenseType)} className={inputBase}>
                  {LICENSES.map(l => <option key={l.value} value={l.value}>{l.short === l.name ? l.name : `${l.short} — ${l.name}`}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">{licenseInfo(licenseType).summary}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover</label>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && setCoverImage(e.target.files[0])} />
                {!coverImage ? (
                  <button type="button" onClick={() => coverInputRef.current?.click()} className="w-full rounded-xl border-2 border-dashed border-gray-300 p-4 text-gray-500 hover:border-violet-400 hover:bg-gray-50 transition-colors">Click to add cover</button>
                ) : (
                  <div className="flex items-center gap-3">
                    <img src={URL.createObjectURL(coverImage)} alt="Cover" className="w-14 h-14 rounded-lg object-cover" />
                    <span className="text-sm text-gray-600 truncate flex-1">{coverImage.name}</span>
                    <button type="button" onClick={() => setCoverImage(null)} className="text-red-500 hover:underline text-sm">Remove</button>
                  </div>
                )}
              </div>
              {audioPreview && tracks[0] && tracks[0].duration > 0 && (
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <SnippetEditor
                    audioSrc={audioPreview}
                    duration={tracks[0].duration}
                    previewStartSec={previewStartSec}
                    previewDurationSec={previewDurationSec}
                    onPreviewChange={(start, dur) => {
                      setPreviewStartSec(start);
                      setPreviewDurationSec(dur);
                    }}
                  />
                </div>
              )}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span>Uploading...</span><span>{uploadProgress}%</span></div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><motion.div className="h-full bg-violet-500 rounded-full" animate={{ width: `${uploadProgress}%` }} transition={{ duration: 0.2 }} /></div>
                </div>
              )}
              <button type="button" onClick={submitSingle} disabled={isUploading} className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-violet-500 text-black font-medium hover:bg-violet-600 disabled:opacity-50">
                <Save size={18} /> {isUploading ? 'Uploading...' : 'Upload Track'}
              </button>
            </div>
          )}

          {isAlbum && (
            <div className="space-y-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Album</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Album title *</label>
                <input type="text" value={albumTitle} onChange={(e) => setAlbumTitle(e.target.value)} className={inputBase} placeholder="Album title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Artist *</label>
                <input type="text" value={artist} onChange={(e) => setArtist(e.target.value)} className={inputBase} placeholder="Artist" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Genre *</label>
                <select value={genre} onChange={(e) => setGenre(e.target.value)} className={inputBase}>
                  <option value="">Select genre</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Downloads</label>
                <select value={downloadPolicy} onChange={(e) => setDownloadPolicy(e.target.value as DownloadPolicy)} className={inputBase}>
                  {DOWNLOAD_POLICY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">{DOWNLOAD_POLICY_OPTIONS.find(o => o.value === downloadPolicy)?.detail} You can change this later from the track's menu.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Licence</label>
                <select value={licenseType} onChange={(e) => setLicenseType(e.target.value as LicenseType)} className={inputBase}>
                  {LICENSES.map(l => <option key={l.value} value={l.value}>{l.short === l.name ? l.name : `${l.short} — ${l.name}`}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">{licenseInfo(licenseType).summary}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover *</label>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && setCoverImage(e.target.files[0])} />
                {!coverImage ? (
                  <button type="button" onClick={() => coverInputRef.current?.click()} className="w-full rounded-xl border-2 border-dashed border-gray-300 p-4 text-gray-500 hover:border-violet-400 hover:bg-gray-50">Click to add cover</button>
                ) : (
                  <div className="flex items-center gap-3">
                    <img src={URL.createObjectURL(coverImage)} alt="Cover" className="w-14 h-14 rounded-lg object-cover" />
                    <span className="text-sm text-gray-600 truncate flex-1">{coverImage.name}</span>
                    <button type="button" onClick={() => setCoverImage(null)} className="text-red-500 hover:underline text-sm">Remove</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tracks (drag to reorder)</label>
                <Reorder.Group axis="y" values={tracks} onReorder={(next) => setTracks(next.map((t, i) => ({ ...t, order: i + 1 })))} className="space-y-2">
                  {tracks.map((track) => (
                    <Reorder.Item key={track.id} value={track} className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 p-3 cursor-grab active:cursor-grabbing">
                      <GripVertical size={18} className="text-gray-400 flex-shrink-0" />
                      <span className="w-6 text-sm text-gray-500 flex-shrink-0">{track.order}</span>
                      <input type="text" value={track.title} onChange={(e) => setTrackTitle(track.id, e.target.value)} className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500" placeholder="Track title" />
                      <span className="text-xs text-gray-500 flex-shrink-0">{formatDuration(track.duration)}</span>
                      <button type="button" onClick={() => removeTrack(track.id)} className="p-1.5 rounded text-red-500 hover:bg-red-50" aria-label="Remove"><X size={16} /></button>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preview snippets (per track)</label>
                <p className="text-xs text-gray-500 mb-3">Set the discover preview for each track. Drag the purple segment or its edges (max 20s).</p>
                <div className="space-y-6">
                  {tracks.map((track) => {
                    const audioSrc = trackObjectUrls[track.id];
                    const start = track.previewStartSec ?? 0;
                    const duration = track.previewDurationSec ?? 20;
                    return (
                      <div key={track.id} className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                        <p className="text-sm font-medium text-gray-800 mb-3">
                          {track.order}. {track.title}
                        </p>
                        {audioSrc && track.duration > 0 ? (
                          <SnippetEditor
                            audioSrc={audioSrc}
                            duration={track.duration}
                            previewStartSec={start}
                            previewDurationSec={duration}
                            onPreviewChange={(startSec, durationSec) => setTrackPreview(track.id, startSec, durationSec)}
                            className=""
                          />
                        ) : (
                          <p className="text-xs text-gray-500">Loading audio...</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {atAlbumLimit && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                  <p className="text-sm font-medium text-gray-800 mb-1">Album limit reached</p>
                  <p className="text-xs text-gray-600 mb-2">Free plan is capped at {FREE_ALBUM_LIMIT} albums.</p>
                  <button type="button" onClick={() => navigate('/upgrade')} className="text-sm text-violet-600 font-medium hover:underline">
                    Upgrade to Pro →
                  </button>
                </div>
              )}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span>Uploading album...</span><span>{uploadProgress}%</span></div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><motion.div className="h-full bg-violet-500 rounded-full" animate={{ width: `${uploadProgress}%` }} transition={{ duration: 0.2 }} /></div>
                </div>
              )}
              <button type="button" onClick={submitAlbum} disabled={isUploading || atAlbumLimit} className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-violet-500 text-black font-medium hover:bg-violet-600 disabled:opacity-50">
                <Save size={18} /> {isUploading ? 'Uploading...' : 'Upload Album'}
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Bottom placeholder: hide once user has dropped files */}
      {tracks.length === 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl bg-white p-10 sm:p-14 shadow-sm border border-gray-200 flex flex-col items-center justify-center min-h-[240px] text-center"
        >
          <div className="flex flex-col items-center gap-4 max-w-sm">
            <p className="text-xs text-gray-500">Click to see the picture</p>
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => setExpandedImage(littlePrinceImg)}
                className="rounded-lg bg-gray-100 p-1 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 cursor-pointer hover:opacity-90 transition-opacity"
              >
                <img src={littlePrinceImg} alt="Little Prince" className="w-24 h-24 object-contain pointer-events-none" />
              </button>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight">
              Please upload!
            </p>
            <p className="text-sm text-gray-500">
              Drop your MP3 or WAV files in the zone above and this message will disappear.
            </p>
          </div>
        </motion.section>
      )}

      {/* Expanded image lightbox */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/100 p-4"
          onClick={() => setExpandedImage(null)}
          aria-label="Close"
        >
          <button
            type="button"
            onClick={() => setExpandedImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/50 text-black hover:bg-white/70 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Close"
          >
            <X size={24} />
          </button>
          <img
            src={expandedImage}
            alt="Expanded view"
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

// Main Upload Component
const Upload: React.FC = () => {
  const { isAuthenticated, user } = useStore();
  const navigate = useNavigate();
  const [resendStatus, setResendStatus] = React.useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  if (!isAuthenticated) {
    return (
      <div className="min-h-full px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight gradient-text font-kyobo sm:text-5xl">Upload</h1>
          <p className="text-black mt-2 text-sm">Share your music with the world</p>
        </header>
        {/* Step preview */}
        <div className="max-w-xl mx-auto mb-8 space-y-3">
          {[
            { icon: '🎵', title: 'Upload your tracks', desc: 'MP3, WAV, AIFF up to 50 MB each' },
            { icon: '🎨', title: 'Add cover art & metadata', desc: 'Genre, title, album art, pricing' },
            { icon: '🚀', title: 'Publish & reach listeners', desc: 'Go live instantly on the platform' },
          ].map((step) => (
            <div key={step.title} className="flex items-center gap-4 p-4 bg-dark-800/60 rounded-xl border border-dark-700/60 opacity-60">
              <span className="text-2xl flex-shrink-0">{step.icon}</span>
              <div>
                <p className="text-black font-medium text-sm">{step.title}</p>
                <p className="text-gray-500 text-xs">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-3 max-w-xs mx-auto">
          <p className="text-gray-400 text-sm text-center">Create an account to start uploading your music</p>
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="w-full px-6 py-3 rounded-xl bg-primary-500 hover:bg-primary-400 text-black font-semibold transition-colors shadow-md"
          >
            Sign Up Free
          </button>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full px-6 py-3 rounded-xl bg-dark-700 hover:bg-dark-600 text-black font-medium transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (user && !user.emailConfirmed) {
    const handleResend = async () => {
      if (!user.email) return;
      setResendStatus('sending');
      try {
        const { AuthService } = await import('../services/authService');
        await AuthService.resendEmailConfirmation(user.email);
        setResendStatus('sent');
      } catch {
        setResendStatus('error');
      }
    };

    return (
      <div className="min-h-full px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight gradient-text font-kyobo sm:text-5xl">
            Upload
          </h1>
        </header>
        <div className="flex flex-col items-center justify-center min-h-[360px] rounded-2xl bg-dark-800/50 p-10 text-center ring-1 ring-white/5">
          <div className="rounded-2xl bg-dark-700/80 p-6 ring-1 ring-white/5 mb-6">
            <Lock size={48} className="text-primary-400" />
          </div>
          <h2 className="text-xl font-semibold text-black mb-2">Confirm your email to upload</h2>
          <p className="text-dark-400 text-center max-w-sm mb-2">
            We sent a confirmation link to <span className="text-black font-medium">{user.email}</span>.
            Click the link in that email to unlock uploads.
          </p>
          <p className="text-dark-500 text-sm mb-8">Check your spam folder if you don't see it.</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendStatus === 'sending' || resendStatus === 'sent'}
            className="px-6 py-3 rounded-xl bg-primary-500 text-black font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md"
          >
            {resendStatus === 'sending' ? 'Sending…' : resendStatus === 'sent' ? 'Email sent!' : resendStatus === 'error' ? 'Failed — try again' : 'Resend confirmation email'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <UnifiedUploadContent />
      </div>
    </div>
  );
};

export default Upload; 