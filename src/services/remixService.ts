import { supabase } from './supabase';
import { requestUploadToken, confirmUpload } from './api';
import { licenseInfo, type LicenseType } from '../config/licenses';
import type { DownloadPolicy } from './downloadService';
import type { SourceTrack } from '../components/remix/engine';

export type RemixBasis = 'own' | 'permission' | 'license';

export interface RemixTerms {
  ok: boolean;
  error?: string;
  trackId?: string;
  sources: { id: string; title: string; artist: string; userId: string; licenseType: LicenseType; basis: RemixBasis }[];
  allowedLicenses: LicenseType[];
  allowPaid: boolean;
}

export interface RemixCredit {
  id: string | null;
  title: string;
  artist: string;
  licenseType: LicenseType;
  basis: RemixBasis;
}

export interface RemixInfo {
  sources: RemixCredit[];
  remixes: { id: string; title: string; artist: string; cover: string; duration: number }[];
  remixCount: number;
}

/**
 * Can `userId` remix this track? 'unknown' when the row didn't include the
 * remix columns (some list queries) — the studio checks again on open.
 */
export function remixAccess(
  track: { userId?: string; licenseType?: string; allowRemix?: boolean },
  userId?: string | null,
): 'own' | 'allowed' | 'blocked' | 'unknown' {
  if (userId && track.userId === userId) return 'own';
  if (track.allowRemix) return 'allowed';
  if (track.licenseType && licenseInfo(track.licenseType).allowsRemix) return 'allowed';
  if (track.allowRemix === false && track.licenseType) return 'blocked';
  return 'unknown';
}

const toSource = (r: any): SourceTrack => ({
  id: r.id,
  title: r.title,
  artist: r.artist,
  cover: r.cover ?? undefined,
  audioUrl: r.audio_url,
  duration: Number(r.duration) || 0,
  licenseType: r.license_type ?? undefined,
  userId: r.user_id ?? undefined,
});

export class RemixService {
  /** Published tracks the signed-in user may remix (own first). */
  static async searchSources(query: string, limit = 30): Promise<SourceTrack[]> {
    const { data, error } = await supabase.rpc('remixable_tracks', { p_query: query || null, p_limit: limit });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toSource);
  }

  /** One track as a source, if the caller may see it. Access is checked by getTerms. */
  static async getSource(trackId: string): Promise<SourceTrack | null> {
    const { data, error } = await supabase
      .from('tracks')
      .select('id, title, artist, cover, audio_url, duration, license_type, user_id')
      .eq('id', trackId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data && data.audio_url ? toSource(data) : null;
  }

  static async getTerms(sourceIds: string[]): Promise<RemixTerms> {
    const { data, error } = await supabase.rpc('remix_terms', { p_sources: sourceIds });
    if (error) throw new Error(error.message);
    const d = data as any;
    return {
      ok: !!d?.ok,
      error: d?.error,
      trackId: d?.track_id,
      sources: (d?.sources ?? []).map((s: any) => ({
        id: s.id, title: s.title, artist: s.artist, userId: s.user_id, licenseType: s.license_type, basis: s.basis,
      })),
      allowedLicenses: d?.allowed_licenses ?? [],
      allowPaid: d?.allow_paid !== false,
    };
  }

  static async getInfo(trackId: string): Promise<RemixInfo | null> {
    const { data, error } = await supabase.rpc('track_remix_info', { p_track: trackId });
    if (error) throw new Error(error.message);
    if (!data) return null;
    const d = data as any;
    return {
      sources: (d.sources ?? []).map((s: any) => ({
        id: s.id ?? null, title: s.title, artist: s.artist, licenseType: s.license_type, basis: s.basis,
      })),
      remixes: d.remixes ?? [],
      remixCount: Number(d.remix_count ?? 0),
    };
  }

  /** Owner only (RLS): let others remix this track. */
  static async setAllowRemix(trackId: string, allow: boolean): Promise<void> {
    const { data, error } = await supabase.from('tracks').update({ allow_remix: allow }).eq('id', trackId).select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error('Only the artist can change this.');
  }

  static async getAllowRemix(trackId: string): Promise<boolean> {
    const { data } = await supabase.from('tracks').select('allow_remix').eq('id', trackId).maybeSingle();
    return !!(data as { allow_remix?: boolean } | null)?.allow_remix;
  }

  /**
   * Upload a rendered remix: copyright check + signed URL, upload, optional
   * cover, then confirm-upload in remix mode (server re-checks the terms).
   */
  static async publish(opts: {
    userId: string;
    audio: Blob;
    duration: number;
    title: string;
    artist: string;
    genre: string;
    license: LicenseType;
    downloadPolicy: DownloadPolicy;
    sourceIds: string[];
    cover?: File | null;
    onStep?: (step: 'check' | 'upload' | 'cover' | 'save') => void;
  }): Promise<{ id: string; status: 'published' | 'pending_review' }> {
    const filename = `${opts.title.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 80) || 'remix'}.mp3`;
    const file = new File([opts.audio], filename, { type: 'audio/mpeg' });

    opts.onStep?.('check');
    const sample = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
      r.onerror = () => resolve('');
      r.readAsDataURL(file.slice(0, 400 * 1024));
    });
    const { token, path, uploadToken } = await requestUploadToken({
      title: opts.title, artist: opts.artist, filename, fileSize: file.size, fileType: 'audio/mpeg', sampleBase64: sample,
    });

    opts.onStep?.('upload');
    const { error: upErr } = await supabase.storage.from('music-files').uploadToSignedUrl(path, token, file, { contentType: 'audio/mpeg' });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    let coverUrl = '';
    if (opts.cover) {
      opts.onStep?.('cover');
      const safe = opts.cover.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const coverPath = `playlist-covers/${opts.userId}/${Date.now()}-${safe}`;
      const { data: img, error: imgErr } = await supabase.storage
        .from('music-files')
        .upload(coverPath, opts.cover, { contentType: opts.cover.type || 'image/jpeg', upsert: false });
      if (imgErr || !img?.path) throw new Error(imgErr?.message || 'Cover upload failed');
      coverUrl = supabase.storage.from('music-files').getPublicUrl(img.path).data.publicUrl;
    }

    opts.onStep?.('save');
    const res = await confirmUpload({
      uploadToken,
      genre: opts.genre,
      duration: Math.round(opts.duration),
      coverUrl,
      downloadPolicy: opts.downloadPolicy,
      licenseType: opts.license,
      remixSources: opts.sourceIds,
    });
    return { id: res.id, status: res.status ?? 'pending_review' };
  }
}
