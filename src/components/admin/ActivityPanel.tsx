import React, { useCallback, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { AdminService, type AdminActivity } from '../../services/adminService';
import { Panel, Loading, Empty, ErrorText, Pager, timeAgo } from './shared';

const STATUS_WORD: Record<string, string> = {
  published: 'live',
  pending_review: 'in review',
  disabled: 'taken down (copyright)',
  removed: 'removed',
};

/** Plain-English line for an audit_log entry. */
export function describeActivity(a: AdminActivity): string {
  const m = a.metadata ?? {};
  const who = m.username ? `@${m.username}` : 'a user';
  const track = m.title ? `“${m.title}”` : 'a track';
  switch (a.action) {
    case 'track_status_changed':
      return `set ${track} to ${STATUS_WORD[m.to] ?? m.to}${m.reason ? ` — ${m.reason}` : ''}`;
    case 'track_report_dismissed':
      return 'dismissed a track report';
    case 'user_suspended':
      return `suspended ${who}${m.reason ? ` — ${m.reason}` : ''}`;
    case 'user_unsuspended':
      return `lifted the suspension on ${who}`;
    case 'verified_artist_on':
      return `verified ${who} as an artist`;
    case 'verified_artist_off':
      return `removed verified artist from ${who}`;
    case 'admin_granted':
      return `made ${who} an admin`;
    case 'admin_revoked':
      return `removed admin access from ${who}`;
    default:
      return `${a.action.replace(/_/g, ' ')} (${a.entityType})`;
  }
}

const ActivityPanel: React.FC<{ limit?: number; compact?: boolean }> = ({ limit, compact }) => {
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AdminActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await AdminService.listActivity(page);
      setRows(limit ? res.rows.slice(0, limit) : res.rows);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => { load(); }, [load]);

  return (
    <Panel title={compact ? 'Recent admin activity' : 'Activity log'} icon={History} count={compact ? undefined : total}>
      {loading ? <Loading /> : error ? <ErrorText>{error}</ErrorText> : rows.length === 0 ? (
        <Empty>No admin actions yet.</Empty>
      ) : (
        <ul className="divide-y-2 divide-black/10">
          {rows.map((a) => (
            <li key={a.id} className="px-4 py-3 text-sm flex flex-wrap items-baseline gap-x-2">
              <span className="font-bold text-black">@{a.actor?.username ?? 'system'}</span>
              <span className="text-black/80 break-words">{describeActivity(a)}</span>
              <span className="ml-auto text-xs text-black/40 whitespace-nowrap" title={new Date(a.createdAt).toLocaleString()}>
                {timeAgo(a.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!compact && <Pager page={page} total={total} onPage={setPage} />}
    </Panel>
  );
};

export default ActivityPanel;
