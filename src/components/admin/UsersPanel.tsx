import React, { useCallback, useEffect, useState } from 'react';
import { Users, UserX, UserCheck, ShieldPlus, ShieldMinus } from 'lucide-react';
import { AdminService, type AdminUserRow, type UserFilter } from '../../services/adminService';
import { useAlerts } from '../../contexts/AlertContext';
import { BrutalButton, BrutalToggle } from '../ui/brutal';
import { Panel, Loading, Empty, ErrorText, SearchBox, FilterChips, Pager, Tag, timeAgo, useDebounced } from './shared';
import { getAvatarUrl } from '../../utils/avatar';

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'musicians', label: 'Musicians' },
  { value: 'verified', label: 'Verified artists' },
  { value: 'admins', label: 'Admins' },
  { value: 'suspended', label: 'Suspended' },
];

const UsersPanel: React.FC<{ initialFilter?: UserFilter; currentUserId?: string; onChanged?: () => void }> = ({
  initialFilter = 'all',
  currentUserId,
  onChanged,
}) => {
  const { addAlert } = useAlerts();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [filter, setFilter] = useState<UserFilter>(initialFilter);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => setFilter(initialFilter), [initialFilter]);
  useEffect(() => setPage(0), [debounced, filter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await AdminService.listUsers({ search: debounced, filter, page });
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [debounced, filter, page]);

  useEffect(() => { load(); }, [load]);

  const patch = (id: string, changes: Partial<AdminUserRow>) =>
    setRows((prev) => prev.map((u) => (u.id === id ? { ...u, ...changes } : u)));

  const toggleVerified = async (u: AdminUserRow) => {
    setBusyId(u.id);
    try {
      await AdminService.setVerifiedArtist(u.id, !u.is_verified_artist);
      patch(u.id, { is_verified_artist: !u.is_verified_artist });
      addAlert(`Verified artist ${u.is_verified_artist ? 'off' : 'on'} for @${u.username}`, 'success');
      onChanged?.();
    } catch (e) {
      addAlert(e instanceof Error ? e.message : 'Update failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggleAdmin = async (u: AdminUserRow) => {
    const granting = !u.is_admin;
    if (granting) {
      // Admin is powerful (takedowns, suspensions, granting admin), so make the
      // admin type the username rather than just clicking OK.
      const typed = window.prompt(
        `Make @${u.username} an admin?\n\nThey'll be able to take down tracks, suspend users, see emails and grant admin to others.\n\nType their username to confirm:`,
      );
      if (typed === null) return;
      if (typed.trim().replace(/^@/, '').toLowerCase() !== u.username.toLowerCase()) {
        addAlert("Username didn't match — nothing changed.", 'error');
        return;
      }
    } else if (!window.confirm(`Remove admin access from @${u.username}?`)) {
      return;
    }
    setBusyId(u.id);
    try {
      await AdminService.setAdmin(u.id, granting);
      patch(u.id, { is_admin: granting });
      addAlert(granting ? `@${u.username} is now an admin` : `@${u.username} is no longer an admin`, 'success');
      onChanged?.();
    } catch (e) {
      addAlert(e instanceof Error ? e.message : 'Update failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggleSuspended = async (u: AdminUserRow) => {
    const suspending = !u.suspended_at;
    let reason: string | undefined;
    if (suspending) {
      const answer = window.prompt(
        `Suspend @${u.username}? They won't be able to upload, message, post or comment.\n\nReason (shown to them, optional):`,
      );
      if (answer === null) return;
      reason = answer;
    } else if (!window.confirm(`Lift the suspension on @${u.username}?`)) {
      return;
    }
    setBusyId(u.id);
    try {
      await AdminService.setSuspended(u.id, suspending, reason);
      patch(u.id, { suspended_at: suspending ? new Date().toISOString() : null });
      addAlert(suspending ? `@${u.username} suspended` : `@${u.username} unsuspended`, 'success');
      onChanged?.();
    } catch (e) {
      addAlert(e instanceof Error ? e.message : 'Update failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel
      title="Users"
      icon={Users}
      count={loading ? '…' : total}
      actions={<SearchBox value={search} onChange={setSearch} placeholder="Search name, artist or email" />}
    >
      <div className="px-4 py-3 border-b-2 border-black bg-[#faf6ec] flex flex-wrap items-center justify-between gap-3">
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        <p className="text-xs text-black/50 max-w-sm">
          Verified artists are confirmed rights holders: their uploads skip the automatic copyright checks.
        </p>
      </div>

      {loading ? <Loading /> : error ? <ErrorText>{error}</ErrorText> : rows.length === 0 ? (
        <Empty>No users match.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-black/60">User</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-black/60">Role</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-black/60">Joined</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-black/60">Verified artist</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-black/60 text-right">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black/10">
              {rows.map((u) => {
                const busy = busyId === u.id;
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className={u.suspended_at ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <img src={getAvatarUrl(u.avatar)} alt="" className="w-9 h-9 rounded-lg border-2 border-black object-cover" />
                        <div className="min-w-0">
                          <a href={`/profile/${u.id}`} className="font-bold text-black hover:underline">@{u.username}</a>
                          <p className="text-xs text-black/60 truncate max-w-[220px]">{u.email ?? '—'}</p>
                          {u.artist_name && <p className="text-xs text-black/40 truncate">{u.artist_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Tag>{u.role === 'musician' ? 'Musician' : 'Listener'}</Tag>
                        {u.is_admin && <Tag className="bg-violet-300">Admin</Tag>}
                        {u.suspended_at && <Tag className="bg-red-300">Suspended</Tag>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-black/60 whitespace-nowrap">{timeAgo(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <BrutalToggle
                        label={`Verified artist for ${u.username}`}
                        checked={u.is_verified_artist}
                        onChange={() => toggleVerified(u)}
                        disabled={busy}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {!isSelf && !u.suspended_at && (
                          u.is_admin ? (
                            <BrutalButton size="sm" tone="white" disabled={busy} onClick={() => toggleAdmin(u)}>
                              <ShieldMinus size={14} /> Remove admin
                            </BrutalButton>
                          ) : (
                            <BrutalButton size="sm" tone="white" disabled={busy} onClick={() => toggleAdmin(u)}>
                              <ShieldPlus size={14} /> Make admin
                            </BrutalButton>
                          )
                        )}
                        {!u.is_admin && !isSelf && (
                          u.suspended_at ? (
                            <BrutalButton size="sm" tone="white" disabled={busy} onClick={() => toggleSuspended(u)}>
                              <UserCheck size={14} /> Unsuspend
                            </BrutalButton>
                          ) : (
                            <BrutalButton size="sm" tone="danger" disabled={busy} onClick={() => toggleSuspended(u)}>
                              <UserX size={14} /> Suspend
                            </BrutalButton>
                          )
                        )}
                        {isSelf && <span className="text-xs text-black/40">You</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} onPage={setPage} />
    </Panel>
  );
};

export default UsersPanel;
