import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Plus, Check, Loader2 } from 'lucide-react';
import { RemixService } from '../../services/remixService';
import LicenseBadge from '../music/LicenseBadge';
import { brutalInput, hardShadow } from '../ui/brutal';
import { fmtTime, type SourceTrack } from './engine';

/** Pick a remixable track: your own, opted-in, or CC (derivatives allowed). */
const SourcePicker: React.FC<{
  usedIds: string[];
  userId?: string;
  onPick: (t: SourceTrack) => void;
  onClose: () => void;
}> = ({ usedIds, userId, onPick, onClose }) => {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<SourceTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const t = setTimeout(() => {
      RemixService.searchSources(q)
        .then((r) => { if (live) { setRows(r); setError(null); } })
        .catch((e) => { if (live) setError(e instanceof Error ? e.message : 'Search failed'); })
        .finally(() => { if (live) setLoading(false); });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a track to your remix"
        className="w-full sm:max-w-lg max-h-[85vh] flex flex-col bg-[#faf6ec] border-2 border-black rounded-t-2xl sm:rounded-2xl"
        style={hardShadow(6)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="!text-lg !font-bold !m-0 text-black">Add a track</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg border-2 border-black bg-white flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title or artist"
              className={`${brutalInput} pl-10`}
            />
          </div>
          <p className="text-xs text-black/60 mt-2">
            Only tracks you're allowed to remix appear here: your own, ones whose artist allows remixes, and Creative Commons tracks that permit adaptations.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
          {loading && rows.length === 0 && (
            <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-black/40" /></div>
          )}
          {error && <p className="text-sm text-red-700 font-semibold py-4">{error}</p>}
          {!loading && !error && rows.length === 0 && (
            <p className="text-sm text-black/60 py-8 text-center">No remixable tracks found{q ? ` for “${q}”` : ''}.</p>
          )}
          {rows.map((t) => {
            const used = usedIds.includes(t.id);
            return (
              <div key={t.id} className="flex items-center gap-3 p-2 bg-white border-2 border-black rounded-xl">
                <img src={t.cover} alt="" className="w-11 h-11 rounded-lg border-2 border-black object-cover bg-black/5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-black truncate">{t.title}</p>
                  <p className="text-xs text-black/60 truncate">
                    {t.artist} · {fmtTime(t.duration)}{t.userId === userId ? ' · Yours' : ''}
                  </p>
                  <div className="mt-1"><LicenseBadge license={t.licenseType} /></div>
                </div>
                <button
                  type="button"
                  disabled={used}
                  onClick={() => onPick(t)}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-black text-xs font-bold bg-teal-300 shadow-[2px_2px_0_0_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:bg-white disabled:shadow-none disabled:opacity-60"
                >
                  {used ? <><Check size={13} /> Added</> : <><Plus size={13} /> Add</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SourcePicker;
