import { supabase } from './supabase';
import { getTrackDownloadUrl } from './api';
import { DEFAULT_LICENSE, type LicenseType } from '../config/licenses';

/** Who can download a track. Set by its artist. */
export type DownloadPolicy = 'off' | 'free' | 'followers' | 'paid';

export type DownloadReason =
  | 'owner' | 'admin' | 'free' | 'follower' | 'purchased'      // allowed
  | 'not_found' | 'unavailable' | 'off' | 'sign_in' | 'follow' | 'buy'; // not allowed

export interface DownloadAccess {
  allowed: boolean;
  reason: DownloadReason;
  policy?: DownloadPolicy;
  artistId?: string;
  artistUsername?: string;
  /** Total downloads — only returned to the owner and admins. */
  downloads?: number | null;
}

export const DOWNLOAD_POLICY_OPTIONS: { value: DownloadPolicy; label: string; detail: string }[] = [
  { value: 'off', label: 'Off', detail: 'Listeners can stream it, but there’s no download button.' },
  { value: 'free', label: 'Free download', detail: 'Anyone signed in to Re-Mixed can download it.' },
  { value: 'followers', label: 'Followers only', detail: 'A reward for people who follow you.' },
  { value: 'paid', label: 'Paid', detail: 'Only people who buy it on your Storefront. List it there to sell.' },
];

export class DownloadService {
  /** Can the current user (or guest) download this track, and if not, why? */
  static async getAccess(trackId: string): Promise<DownloadAccess> {
    const { data, error } = await supabase.rpc('track_download_access', { p_track_id: trackId });
    if (error) throw new Error(error.message);
    const d = (data ?? {}) as Record<string, any>;
    return {
      allowed: Boolean(d.allowed),
      reason: d.reason,
      policy: d.policy,
      artistId: d.artist_id,
      artistUsername: d.artist_username,
      downloads: d.downloads ?? null,
    };
  }

  /** Owner only (RLS): change who can download the track. */
  static async setPolicy(trackId: string, policy: DownloadPolicy): Promise<void> {
    const { data, error } = await supabase
      .from('tracks')
      .update({ download_policy: policy })
      .eq('id', trackId)
      .select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error('Only the artist can change download settings for this track.');
  }

  /** Owner only (RLS): the track's licence. */
  static async getLicense(trackId: string): Promise<LicenseType> {
    const { data, error } = await supabase.from('tracks').select('license_type').eq('id', trackId).maybeSingle();
    if (error) throw new Error(error.message);
    return ((data as { license_type?: LicenseType } | null)?.license_type ?? DEFAULT_LICENSE);
  }

  /** Owner only (RLS): save download setting and licence together. */
  static async saveSettings(trackId: string, settings: { policy: DownloadPolicy; license: LicenseType; allowRemix?: boolean }): Promise<void> {
    const patch: Record<string, unknown> = { download_policy: settings.policy, license_type: settings.license };
    if (settings.allowRemix !== undefined) patch.allow_remix = settings.allowRemix;
    const { data, error } = await supabase
      .from('tracks')
      .update(patch)
      .eq('id', trackId)
      .select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error('Only the artist can change settings for this track.');
  }

  /** Fetch a signed link and start the browser download. */
  static async download(trackId: string): Promise<void> {
    const { downloadUrl } = await getTrackDownloadUrl(trackId);
    // The signed URL carries Content-Disposition: attachment, so this downloads
    // rather than navigating away.
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
