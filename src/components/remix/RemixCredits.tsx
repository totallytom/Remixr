import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, Layers } from 'lucide-react';
import { RemixService, type RemixInfo, type RemixBasis } from '../../services/remixService';
import LicenseBadge from '../music/LicenseBadge';
import { hardShadow } from '../ui/brutal';

export const BASIS_LABEL: Record<RemixBasis, string> = {
  own: 'Remixer’s own track',
  permission: 'Artist allows remixes',
  license: 'Used under its Creative Commons licence',
};

/** "Remix of …" credits for a track, plus remixes made from it. */
const RemixCredits: React.FC<{ trackId: string; trackTitle: string; onClose: () => void }> = ({ trackId, trackTitle, onClose }) => {
  const navigate = useNavigate();
  const [info, setInfo] = useState<RemixInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    RemixService.getInfo(trackId)
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load credits'))
      .finally(() => setLoading(false));
  }, [trackId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Remix credits for ${trackTitle}`}
        className="w-full sm:max-w-md max-h-[80vh] overflow-y-auto bg-[#faf6ec] border-2 border-black rounded-t-2xl sm:rounded-2xl p-5"
        style={hardShadow(6)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-black/60">Remix credits</p>
            <h2 className="!text-lg !font-bold !m-0 text-black truncate">{trackTitle}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg border-2 border-black bg-white flex items-center justify-center flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {loading && <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-black/40" /></div>}
        {error && <p className="text-sm font-semibold text-red-700">{error}</p>}

        {info && info.sources.length > 0 && (
          <section className="mb-5">
            <h3 className="!text-sm !font-bold !m-0 !mb-2 text-black">Made from</h3>
            <ol className="space-y-2">
              {info.sources.map((s, i) => (
                <li key={i} className="p-3 bg-white border-2 border-black rounded-xl">
                  <p className="text-sm font-bold text-black">{s.title}</p>
                  <p className="text-xs text-black/60">by {s.artist}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <LicenseBadge license={s.licenseType} />
                    <span className="text-[11px] text-black/60">{BASIS_LABEL[s.basis]}</span>
                  </div>
                  {!s.id && <p className="text-[11px] text-black/50 mt-1">The original is no longer available.</p>}
                </li>
              ))}
            </ol>
          </section>
        )}

        {info && (
          <section>
            <h3 className="!text-sm !font-bold !m-0 !mb-2 text-black">
              Remixes of this track{info.remixCount ? ` (${info.remixCount})` : ''}
            </h3>
            {info.remixes.length === 0 ? (
              <p className="text-sm text-black/60">No remixes yet.</p>
            ) : (
              <ul className="space-y-2">
                {info.remixes.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 p-2 bg-white border-2 border-black rounded-xl">
                    <img src={r.cover} alt="" className="w-10 h-10 rounded-lg border-2 border-black object-cover" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-black truncate">{r.title}</p>
                      <p className="text-xs text-black/60 truncate">{r.artist}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <button
          type="button"
          onClick={() => { onClose(); navigate(`/remix/${trackId}`); }}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-black bg-teal-300 font-bold text-sm shadow-[3px_3px_0_0_#000] active:shadow-none active:translate-x-[3px] active:translate-y-[3px]"
        >
          <Layers size={16} /> Remix this track
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default RemixCredits;
