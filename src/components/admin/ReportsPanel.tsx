import React, { useCallback, useEffect, useState } from 'react';
import { Flag, Music, UserX, MessageSquareX, X, Ticket, CalendarX } from 'lucide-react';
import { useAlerts } from '../../contexts/AlertContext';
import { BrutalButton } from '../ui/brutal';
import { Panel, Loading, Empty, ErrorText, Tag, TrackStatusBadge, timeAgo } from './shared';
import TakedownDialog, { type TakedownKind } from './TakedownDialog';
import { AdminService, type AdminTrackReport } from '../../services/adminService';
import {
  getOpenUserReports,
  reasonLabel,
  resolveUserReport,
  type ReportAction,
  type UserReport,
} from '../../services/reportService';

const ACTION_CONFIRM: Record<ReportAction, (r: UserReport) => string> = {
  dismiss: () => 'Dismiss this report? No action will be taken.',
  remove_message: () => 'Delete this message for everyone? This also closes other open reports about it.',
  remove_concert: (r) =>
    `Delete the concert listing “${r.concert?.title ?? 'this concert'}” for everyone? This also closes other open reports about it.`,
  suspend_user: (r) =>
    `Suspend @${r.reported?.username ?? 'this user'}? They won't be able to upload, message, post or comment. This closes all open reports about them.`,
};

const TRACK_REASON_LABEL: Record<string, string> = {
  copyright: 'Copyright',
  impersonation: 'Impersonation',
  other: 'Other',
};

const ReportsPanel: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const { addAlert } = useAlerts();
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [trackReports, setTrackReports] = useState<AdminTrackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [takedown, setTakedown] = useState<AdminTrackReport | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setUserError(null);
    setTrackError(null);
    const [u, t] = await Promise.allSettled([getOpenUserReports(), AdminService.listOpenTrackReports()]);
    if (u.status === 'fulfilled') setUserReports(u.value);
    else setUserError(u.reason instanceof Error ? u.reason.message : 'Failed to load reports');
    if (t.status === 'fulfilled') setTrackReports(t.value);
    else setTrackError(t.reason instanceof Error ? t.reason.message : 'Failed to load track reports');
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolveUser = async (r: UserReport, action: ReportAction) => {
    if (!window.confirm(ACTION_CONFIRM[action](r))) return;
    setBusyId(r.id);
    try {
      await resolveUserReport(r.id, action);
      addAlert(
        action === 'dismiss' ? 'Report dismissed'
          : action === 'remove_message' ? 'Message removed'
          : action === 'remove_concert' ? 'Concert listing removed'
          : `@${r.reported?.username ?? 'User'} suspended`,
        'success',
      );
      setUserReports(await getOpenUserReports());
      onChanged?.();
    } catch (e) {
      addAlert(e instanceof Error ? e.message : 'Could not resolve report', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const dismissTrackReport = async (r: AdminTrackReport) => {
    if (!window.confirm('Dismiss this report? The track stays up.')) return;
    setBusyId(r.id);
    try {
      await AdminService.dismissTrackReport(r.id);
      addAlert('Report dismissed', 'success');
      setTrackReports((prev) => prev.filter((x) => x.id !== r.id));
      onChanged?.();
    } catch (e) {
      addAlert(e instanceof Error ? e.message : 'Could not dismiss', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const takeDownFromReport = async (r: AdminTrackReport, kind: TakedownKind, reason: string) => {
    if (!r.track) return;
    setBusyId(r.id);
    try {
      await AdminService.setTrackStatus(r.track.id, kind, reason, r.id);
      addAlert(`“${r.track.title}” taken down`, 'success');
      setTakedown(null);
      await load();
      onChanged?.();
    } catch (e) {
      addAlert(e instanceof Error ? e.message : 'Take-down failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Panel title="Reports" icon={Flag}><Loading /></Panel>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      {/* ── People & messages ── */}
      <Panel title="People, messages & concerts" icon={Flag} count={userError ? '!' : userReports.length}>
        {userError ? <ErrorText>{userError}</ErrorText> : userReports.length === 0 ? (
          <Empty>No open reports about users, messages or concerts. 🎉</Empty>
        ) : (
          <ul className="divide-y-2 divide-black/10">
            {userReports.map((r) => {
              const busy = busyId === r.id;
              return (
                <li key={r.id} className="px-4 py-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <Tag className="bg-red-300">{reasonLabel(r.reason)}</Tag>
                    <Tag>{r.concertId ? 'Concert' : r.messageId ? 'Message' : 'User'}</Tag>
                    {r.reported?.suspendedAt && <Tag className="bg-gray-300">Suspended</Tag>}
                    {r.reportCountForUser > 1 && <Tag className="bg-orange-300">{r.reportCountForUser} open reports</Tag>}
                  </div>
                  <p className="text-sm text-black">
                    {r.concertId ? 'Concert listed by ' : r.messageId ? 'Message from ' : 'Reported user '}
                    <a href={`/profile/${r.reported?.id ?? ''}`} className="font-bold underline">@{r.reported?.username ?? 'deleted user'}</a>
                  </p>
                  {r.messageId && (
                    <blockquote className="border-l-4 border-black pl-3 py-1 text-sm text-black/80 bg-black/5 rounded-r-lg whitespace-pre-wrap break-words">
                      {r.messageExcerpt ?? <span className="italic text-black/40">Message text unavailable</span>}
                    </blockquote>
                  )}
                  {r.concert && (
                    <div className="border-2 border-black rounded-lg bg-violet-100 px-3 py-2 text-sm space-y-0.5">
                      <p className="flex items-center gap-1.5 font-bold text-black">
                        <Ticket size={14} className="flex-shrink-0" /> {r.concert.title}
                      </p>
                      <p className="text-black/70">
                        {[
                          r.concert.date && new Date(r.concert.date).toLocaleDateString(undefined, { timeZone: 'UTC' }),
                          r.concert.venue,
                          r.concert.location,
                        ].filter(Boolean).join(' · ')}
                      </p>
                      {r.concert.ticketUrl && (
                        <a
                          href={r.concert.ticketUrl}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="block underline text-violet-800 break-all"
                        >
                          {r.concert.ticketUrl}
                        </a>
                      )}
                      {r.concert.description && <p className="text-black/60 line-clamp-3">{r.concert.description}</p>}
                    </div>
                  )}
                  {r.details && <p className="text-sm text-black/70">“{r.details}”</p>}
                  <p className="text-xs text-black/50">Reported by @{r.reporter?.username ?? 'deleted user'} · {timeAgo(r.createdAt)}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <BrutalButton size="sm" tone="white" disabled={busy} onClick={() => resolveUser(r, 'dismiss')}>
                      <X size={14} /> Dismiss
                    </BrutalButton>
                    {r.concertId && (
                      <BrutalButton size="sm" tone="white" disabled={busy} onClick={() => resolveUser(r, 'remove_concert')}>
                        <CalendarX size={14} /> Remove listing
                      </BrutalButton>
                    )}
                    {r.messageId && (
                      <BrutalButton size="sm" tone="white" disabled={busy} onClick={() => resolveUser(r, 'remove_message')}>
                        <MessageSquareX size={14} /> Remove message
                      </BrutalButton>
                    )}
                    {!r.reported?.suspendedAt && (
                      <BrutalButton size="sm" tone="danger" disabled={busy} onClick={() => resolveUser(r, 'suspend_user')}>
                        <UserX size={14} /> Suspend user
                      </BrutalButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* ── Tracks ── */}
      <Panel title="Tracks" icon={Music} count={trackError ? '!' : trackReports.length}>
        {trackError ? <ErrorText>{trackError}</ErrorText> : trackReports.length === 0 ? (
          <Empty>No open track reports.</Empty>
        ) : (
          <ul className="divide-y-2 divide-black/10">
            {trackReports.map((r) => {
              const busy = busyId === r.id;
              return (
                <li key={r.id} className="px-4 py-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg border-2 border-black overflow-hidden bg-black/5 flex-shrink-0">
                      {r.track?.cover && <img src={r.track.cover} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-black truncate">{r.track?.title ?? 'Deleted track'}</p>
                      <p className="text-xs text-black/60 truncate">
                        {r.track?.artist}
                        {r.owner && <> · <a href={`/profile/${r.owner.id}`} className="underline">@{r.owner.username}</a></>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Tag className="bg-red-300">{TRACK_REASON_LABEL[r.reason] ?? r.reason}</Tag>
                    {r.track && <TrackStatusBadge status={r.track.status} />}
                  </div>
                  {r.details && <p className="text-sm text-black/70 break-words">“{r.details}”</p>}
                  <p className="text-xs text-black/50">Reported by @{r.reporter?.username ?? 'deleted user'} · {timeAgo(r.receivedAt)}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <BrutalButton size="sm" tone="white" disabled={busy} onClick={() => dismissTrackReport(r)}>
                      <X size={14} /> Dismiss
                    </BrutalButton>
                    {r.track && r.track.status !== 'disabled' && r.track.status !== 'removed' && (
                      <BrutalButton size="sm" tone="danger" disabled={busy} onClick={() => setTakedown(r)}>
                        Take down track
                      </BrutalButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {takedown?.track && (
        <TakedownDialog
          trackTitle={takedown.track.title}
          defaultKind={takedown.reason === 'copyright' ? 'disabled' : 'removed'}
          defaultReason={takedown.details ? `Reported: ${takedown.details}` : ''}
          busy={busyId === takedown.id}
          onClose={() => setTakedown(null)}
          onConfirm={(kind, reason) => takeDownFromReport(takedown, kind, reason)}
        />
      )}
    </div>
  );
};

export default ReportsPanel;
