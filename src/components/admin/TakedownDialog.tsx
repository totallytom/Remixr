import React, { useState } from 'react';
import { X } from 'lucide-react';
import { BrutalButton, brutalInput, hardShadow } from '../ui/brutal';

export type TakedownKind = 'disabled' | 'removed';

interface TakedownDialogProps {
  trackTitle: string;
  /** Pre-filled from a report, e.g. the reporter's reason. */
  defaultReason?: string;
  defaultKind?: TakedownKind;
  busy?: boolean;
  onConfirm: (kind: TakedownKind, reason: string) => void;
  onClose: () => void;
}

/** Asks why a track is being taken down; the reason is shown to the artist. */
const TakedownDialog: React.FC<TakedownDialogProps> = ({
  trackTitle,
  defaultReason = '',
  defaultKind = 'removed',
  busy,
  onConfirm,
  onClose,
}) => {
  const [kind, setKind] = useState<TakedownKind>(defaultKind);
  const [reason, setReason] = useState(defaultReason);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label="Take down track" className="w-full max-w-md bg-[#faf6ec] border-2 border-black rounded-2xl p-5" style={hardShadow(8)}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-kotra text-2xl text-black leading-tight">Take down track</h2>
            <p className="text-sm text-black/60 mt-1 break-words">“{trackTitle}”</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="p-1.5 rounded-lg border-2 border-black bg-white" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <fieldset className="space-y-2 mb-4">
          <legend className="text-xs font-bold uppercase tracking-wide text-black/70 mb-1.5">Why?</legend>
          {([
            { value: 'disabled', label: 'Copyright', detail: 'Uses someone else’s music without permission.' },
            { value: 'removed', label: 'Other rule broken', detail: 'Spam, hateful, explicit, misleading, etc.' },
          ] as const).map((o) => (
            <label
              key={o.value}
              className={`flex items-start gap-3 p-3 rounded-xl border-2 border-black cursor-pointer ${kind === o.value ? 'bg-teal-300' : 'bg-white'}`}
            >
              <input
                type="radio"
                name="takedown-kind"
                checked={kind === o.value}
                onChange={() => setKind(o.value)}
                className="mt-1 accent-black"
              />
              <span>
                <span className="block text-sm font-bold text-black">{o.label}</span>
                <span className="block text-xs text-black/60">{o.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label htmlFor="takedown-reason" className="block text-xs font-bold uppercase tracking-wide text-black/70 mb-1.5">
          Message to the artist
        </label>
        <textarea
          id="takedown-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="Explain what was wrong so they understand."
          className={`${brutalInput} resize-none text-sm`}
        />
        <p className="text-[11px] text-black/50 mt-1 mb-4">
          The track is hidden everywhere, pulled from the Storefront, and the artist is notified. You can restore it later.
        </p>

        <div className="flex gap-2">
          <BrutalButton tone="white" onClick={onClose} disabled={busy} className="flex-1">Cancel</BrutalButton>
          <BrutalButton tone="danger" onClick={() => onConfirm(kind, reason.trim())} disabled={busy || !reason.trim()} className="flex-1">
            {busy ? 'Taking down…' : 'Take down'}
          </BrutalButton>
        </div>
      </div>
    </div>
  );
};

export default TakedownDialog;
