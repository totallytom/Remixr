import { supabase } from './supabase';
import type { TrackStatus, TakedownReason } from './supabase';

// Admin console data + actions. Reads use the admin RLS policies; every change
// goes through an admin_* database function (server-side admin check, audit
// log, user notification). Shared backend with the mobile admin screens.

export const ADMIN_PAGE_SIZE = 25;

// ─── Users ────────────────────────────────────────────────────────────────────

/** Minimal user row for admin lists. */
export interface AdminUserRow {
  id: string;
  username: string;
  /** Filled from auth.users via admin_user_emails (public.users no longer stores emails). */
  email: string | null;
  role: string;
  avatar: string | null;
  is_verified_artist: boolean;
  is_admin: boolean;
  artist_name: string | null;
  suspended_at: string | null;
  created_at: string;
}

export type UserFilter = 'all' | 'musicians' | 'verified' | 'admins' | 'suspended';

function toAdminRow(row: any): AdminUserRow {
  return {
    id: row.id,
    username: row.username,
    email: null,
    role: row.role,
    avatar: row.avatar ?? null,
    is_verified_artist: row.is_verified_artist ?? false,
    is_admin: row.is_admin ?? false,
    artist_name: row.artist_name ?? null,
    suspended_at: row.suspended_at ?? null,
    created_at: row.created_at,
  };
}

/** Escape % and _ so a search term is matched literally in ilike. */
const likeTerm = (s: string) => `%${s.trim().replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, ' ')}%`;

// ─── Tracks ───────────────────────────────────────────────────────────────────

export interface AdminTrackRow {
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  audioUrl: string | null;
  genre: string | null;
  status: TrackStatus;
  removedReason: string | null;
  removedAt: string | null;
  createdAt: string;
  owner: { id: string; username: string } | null;
  openReports: number;
}

export type TrackFilter = 'all' | TrackStatus;

// ─── Track reports (takedown_requests from users) ────────────────────────────

export interface AdminTrackReport {
  id: string;
  reason: TakedownReason;
  details: string | null;
  receivedAt: string;
  track: { id: string; title: string; artist: string; cover: string | null; status: TrackStatus } | null;
  owner: { id: string; username: string } | null;
  reporter: { id: string; username: string } | null;
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export interface AdminActivity {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  actor: { id: string; username: string } | null;
}

export interface AdminStats {
  open_user_reports: number;
  open_track_reports: number;
  open_dmca_notices: number;
  counter_notices: number;
  users_total: number;
  users_new_7d: number;
  users_suspended: number;
  verified_artists: number;
  tracks_published: number;
  tracks_pending: number;
  tracks_taken_down: number;
  tracks_new_7d: number;
}

async function rpcOk(fn: string, args: Record<string, unknown>, notOkMessages: Record<string, string> = {}): Promise<void> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  if (data !== 'ok') throw new Error(notOkMessages[data as string] ?? 'Not found — it may have been deleted.');
}

export class AdminService {
  // ── Overview ──
  static async getStats(): Promise<AdminStats> {
    const { data, error } = await supabase.rpc('admin_dashboard_stats');
    if (error) throw new Error(error.message);
    return data as AdminStats;
  }

  // ── Users ──
  static async listUsers(
    opts: { search?: string; filter?: UserFilter; page?: number } = {},
  ): Promise<{ rows: AdminUserRow[]; total: number }> {
    const { search = '', filter = 'all', page = 0 } = opts;
    let q = supabase
      .from('users')
      .select('id, username, role, avatar, is_verified_artist, is_admin, artist_name, suspended_at, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE + ADMIN_PAGE_SIZE - 1);

    if (search.trim().includes('@')) {
      // Emails are private (auth.users only): look them up through the admin function.
      const { data: ids, error: idsError } = await supabase.rpc('admin_search_users_by_email', { p_term: search.trim() });
      if (idsError) throw new Error(idsError.message);
      const list = (ids ?? []) as string[];
      if (list.length === 0) return { rows: [], total: 0 };
      q = q.in('id', list);
    } else if (search.trim()) {
      const t = likeTerm(search);
      q = q.or(`username.ilike.${t},artist_name.ilike.${t}`);
    }
    if (filter === 'musicians') q = q.eq('role', 'musician');
    if (filter === 'verified') q = q.eq('is_verified_artist', true);
    if (filter === 'admins') q = q.eq('is_admin', true);
    if (filter === 'suspended') q = q.not('suspended_at', 'is', null);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map(toAdminRow);

    // Fill in emails from the private auth table (admin-only function).
    if (rows.length) {
      const { data: emails } = await supabase.rpc('admin_user_emails', { p_ids: rows.map((r) => r.id) });
      const byId = new Map(((emails ?? []) as { id: string; email: string }[]).map((e) => [e.id, e.email]));
      rows.forEach((r) => { r.email = byId.get(r.id) ?? null; });
    }
    return { rows, total: count ?? 0 };
  }

  static setVerifiedArtist(userId: string, value: boolean): Promise<void> {
    return rpcOk('admin_set_verified_artist', { p_user_id: userId, p_value: value });
  }

  static setAdmin(userId: string, value: boolean): Promise<void> {
    return rpcOk(
      'admin_set_admin',
      { p_user_id: userId, p_value: value },
      {
        cannot_demote_self: "You can't remove your own admin access.",
        last_admin: "You can't remove the last admin.",
        user_suspended: 'Lift the suspension before making this user an admin.',
      },
    );
  }

  static setSuspended(userId: string, suspended: boolean, reason?: string): Promise<void> {
    return rpcOk(
      'admin_set_user_suspension',
      { p_user_id: userId, p_suspended: suspended, p_reason: reason ?? null },
      { cannot_suspend_admin: "Admins can't be suspended." },
    );
  }

  // ── Tracks ──
  static async listTracks(
    opts: { search?: string; filter?: TrackFilter; page?: number } = {},
  ): Promise<{ rows: AdminTrackRow[]; total: number }> {
    const { search = '', filter = 'all', page = 0 } = opts;
    let q = supabase
      .from('tracks')
      .select(
        'id, title, artist, cover, audio_url, genre, status, removed_reason, removed_at, created_at, owner:users!tracks_user_id_fkey (id, username)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(page * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE + ADMIN_PAGE_SIZE - 1);

    if (search.trim()) {
      const t = likeTerm(search);
      q = q.or(`title.ilike.${t},artist.ilike.${t}`);
    }
    if (filter !== 'all') q = q.eq('status', filter);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    const rows = data ?? [];

    // Open user reports per track on this page.
    const ids = rows.map((r: any) => r.id);
    const reportCounts = new Map<string, number>();
    if (ids.length) {
      const { data: reps } = await supabase
        .from('takedown_requests')
        .select('track_id')
        .in('track_id', ids)
        .eq('status', 'received');
      (reps ?? []).forEach((r: any) => reportCounts.set(r.track_id, (reportCounts.get(r.track_id) ?? 0) + 1));
    }

    return {
      total: count ?? 0,
      rows: rows.map((r: any) => {
        const owner = Array.isArray(r.owner) ? r.owner[0] : r.owner;
        return {
          id: r.id,
          title: r.title,
          artist: r.artist,
          cover: r.cover ?? null,
          audioUrl: r.audio_url ?? null,
          genre: r.genre ?? null,
          status: r.status,
          removedReason: r.removed_reason ?? null,
          removedAt: r.removed_at ?? null,
          createdAt: r.created_at,
          owner: owner ? { id: owner.id, username: owner.username } : null,
          openReports: reportCounts.get(r.id) ?? 0,
        };
      }),
    };
  }

  /**
   * published = restore/approve · disabled = copyright takedown ·
   * removed = other policy violation · pending_review = hold for review.
   */
  static setTrackStatus(trackId: string, status: TrackStatus, reason?: string, takedownRequestId?: string): Promise<void> {
    return rpcOk('admin_set_track_status', {
      p_track_id: trackId,
      p_status: status,
      p_reason: reason ?? null,
      p_takedown_request_id: takedownRequestId ?? null,
    });
  }

  // ── Track reports ──
  static async listOpenTrackReports(): Promise<AdminTrackReport[]> {
    const { data, error } = await supabase
      .from('takedown_requests')
      .select(`
        id, reason, details, received_at,
        track:tracks!takedown_requests_track_id_fkey (id, title, artist, cover, status),
        owner:users!takedown_requests_track_owner_id_fkey (id, username),
        reporter:users!takedown_requests_reporter_user_id_fkey (id, username)
      `)
      .eq('source', 'user_report')
      .eq('status', 'received')
      .order('received_at', { ascending: false });
    if (error) throw new Error(error.message);
    const one = (v: any) => (Array.isArray(v) ? v[0] : v) ?? null;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      reason: r.reason,
      details: r.details ?? null,
      receivedAt: r.received_at,
      track: one(r.track),
      owner: one(r.owner),
      reporter: one(r.reporter),
    }));
  }

  static dismissTrackReport(requestId: string): Promise<void> {
    return rpcOk('admin_dismiss_track_report', { p_request_id: requestId });
  }

  // ── Activity ──
  static async listActivity(page = 0): Promise<{ rows: AdminActivity[]; total: number }> {
    const { data, error, count } = await supabase
      .from('audit_log')
      .select('id, action, entity_type, entity_id, metadata, created_at, actor:users!audit_log_actor_id_fkey (id, username)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE + ADMIN_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    return {
      total: count ?? 0,
      rows: (data ?? []).map((r: any) => ({
        id: r.id,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id ?? null,
        metadata: r.metadata ?? {},
        createdAt: r.created_at,
        actor: (Array.isArray(r.actor) ? r.actor[0] : r.actor) ?? null,
      })),
    };
  }
}
