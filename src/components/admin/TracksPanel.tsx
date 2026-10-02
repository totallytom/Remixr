import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Music, Pause, Play, RotateCcw, CheckCircle2, ShieldOff, Flag } from 'lucide-react';
import { AdminService, type AdminTrackRow, type TrackFilter } from '../../services/adminService';
import { useAlerts } from '../../contexts/AlertContext';
import { BrutalButton } from '../ui/brutal';
import { Panel, Loading, Empty, ErrorText, SearchBox, FilterChips, Pager, TrackStatusBadge, Tag, timeAgo, useDebounced } from './shared';
import TakedownDialog, { type TakedownKind } from './TakedownDialog';

const FILTERS: { value: TrackFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Live' },
  { value: 'pending_review', label: 'In review' },
  { value: 'disabled', label: 'Copyright takedowns' },
  { value: 'removed', label: 'Removed' },
];

const TracksPanel: React.FC<{ initialFilter?: TrackFilter; onChanged?: () => void }> = ({ initialFilter = 'all', onChanged }) => {
  const { addAlert } = useAlerts();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [filter, setFilter] = useState<TrackFilter>(initialFilter);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AdminTrackRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [takedown, setTakedown] = useState<AdminTrackRow | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => setFilter(initialFilter), [initialFilter]);
  useEffect(() => setPage(0), [debounced, filter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await AdminService.listTracks({ search: debounced, filter, page });
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tracks');
    } finally {
      setLoading(false);
    }
  }, [debounced, filter, page]);

  useEffect(() => { load(); }, [load]);

  // Stop preview when leaving the panel.
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const togglePlay = (t: AdminTrackRow) => {
    if (!t.audioUrl) return;
    if (playingId === t.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const a = new Audio(t.audioUrl);
    a.onended = () => setPlayingId(null);
    a.play().catch(() => addAlert('Could not play this file.', 'error'));
    audioRef.current = a;
    setPlayingId(t.id);
  };

  const setStatus = async (t: AdminTrackRow, status: AdminTrackRow['status'], reason?: string) => {
    setBusyId(t.id);
    try {
      await AdminService.setTrackStatus(t.id, status, reason);
      addAlert(
        status === 'published' ? `“${t.title}” is live` : `“${t.title}” taken down`,
        'success',
      );
      setTakedown(null);
      await load();
      onChanged?.();
    } catch (e) {
      addAlert(e instanceof Error ? e.message : 'Update failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel
      title="All tracks"
      icon={Music}
      count={loading ? '…' : total}
      actions={<SearchBox value={search} onChange={setSearch} placeholder="Search title or artist" />}
    >
      <div className="px-4 py-3 border-b-2 border-black bg-[#faf6ec]">
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      {loading ? <Loading /> : error ? <ErrorText>{error}</ErrorText> : rows.length === 0 ? (
        <Empty>No tracks match.</Empty>
      ) : (
        <ul className="divide-y-2 divide-black/10">
          {rows.map((t) => {
            const busy = busyId === t.id;
            const down = t.status === 'disabled' || t.status === 'removed';
            return (
              <li key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => togglePlay(t)}
                    disabled={!t.audioUrl}
                    className="relative w-12 h-12 flex-shrink-0 rounded-lg border-2 border-black overflow-hidden bg-black/5 group disabled:cursor-not-allowed"
                    aria-label={playingId === t.id ? `Pause ${t.title}` : `Play ${t.title}`}
                  >
                    {t.cover && <img src={t.cover} alt="" className="w-full h-full object-cover" />}
                    {t.audioUrl && (
                      <span className={`absolute inset-0 flex items-center justify-center bg-black/50 text-white ${playingId === t.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        {playingId === t.id ? <Pause size={16} /> : <Play size={16} />}
                      </span>
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="font-bold text-black truncate">{t.title}</p>
                    <p className="text-xs text-black/60 truncate">
                      {t.artist}
                      {t.owner && (
                        <> · <a href={`/profile/${t.owner.id}`} className="underline hover:text-black">@{t.owner.username}</a></>
                      )}
                      {' · '}{timeAgo(t.createdAt)}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <TrackStatusBadge status={t.status} />
                      {t.openReports > 0 && (
                        <Tag className="bg-orange-300"><Flag size={10} className="inline -mt-0.5 mr-1" />{t.openReports} open report{t.openReports > 1 ? 's' : ''}</Tag>
                      )}
                    </div>
                    {down && t.removedReason && (
                      <p className="text-xs text-black/60 mt-1 break-words">Reason: {t.removedReason}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {t.status === 'pending_review' && (
                    <BrutalButton size="sm" tone="teal" disabled={busy} onClick={() => setStatus(t, 'published')}>
                      <CheckCircle2 size={14} /> Approve
                    </BrutalButton>
                  )}
                  {down ? (
                    <BrutalButton
                      size="sm"
                      tone="white"
                      disabled={busy}
                      onClick={() => { if (window.confirm(`Restore “${t.title}”? It will be visible to everyone again.`)) setStatus(t, 'published'); }}
                    >
                      <RotateCcw size={14} /> Restore
                    </BrutalButton>
                  ) : (
                    <BrutalButton size="sm" tone="danger" disabled={busy} onClick={() => setTakedown(t)}>
                      <ShieldOff size={14} /> Take down
                    </BrutalButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} total={total} onPage={setPage} />

      {takedown && (
        <TakedownDialog
          trackTitle={takedown.title}
          busy={busyId === takedown.id}
          onClose={() => setTakedown(null)}
          onConfirm={(kind: TakedownKind, reason) => setStatus(takedown, kind, reason)}
        />
      )}
    </Panel>
  );
};

export default TracksPanel;
