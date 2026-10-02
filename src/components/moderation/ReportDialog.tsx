import React, { useState } from 'react';
import { Flag, Loader2, CheckCircle2 } from 'lucide-react';
import Modal from '../Modal';
import { REPORT_REASONS, submitUserReport, type ReportReason, type ReportTarget } from '../../services/reportService';

interface ReportDialogProps {
  target: ReportTarget;
  onClose: () => void;
}

const MAX_DETAILS = 1000;

/** Report a user, or one of their messages when target.messageId is set. */
const ReportDialog: React.FC<ReportDialogProps> = ({ target, onClose }) => {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<'ok' | 'already_reported' | null>(null);

  const isMessage = Boolean(target.messageId);
  const title = isMessage ? 'Report message' : `Report @${target.username}`;

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      setResult(await submitUserReport(target, reason, details));
    } catch (err) {
      setError(err instanceof Error ? err.message : "This couldn't be reported. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <Modal onClose={onClose} title={title}>
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          <p className="text-sm text-black">
            {result === 'ok'
              ? "Thanks for letting us know. Our team will review this report."
              : "You've already reported this, and it's waiting for review."}
          </p>
          <p className="text-xs text-black/50">
            If you're in danger or someone is at risk of harm, contact local emergency services.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 px-5 py-2 rounded-lg bg-primary-600 text-black text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-black/70">
          {isMessage
            ? `Why are you reporting this message from @${target.username}?`
            : `Why are you reporting @${target.username}?`}{' '}
          They won't be told who reported them.
        </p>

        <div role="radiogroup" aria-label="Reason" className="space-y-1.5">
          {REPORT_REASONS.map((r) => (
            <label
              key={r.value}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                reason === r.value ? 'border-primary-500 bg-primary-500/10' : 'border-dark-600 hover:border-dark-500'
              }`}
            >
              <input
                type="radio"
                name="report-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => { setReason(r.value); setError(null); }}
                className="accent-primary-600"
              />
              <span className="text-black">{r.label}</span>
            </label>
          ))}
        </div>

        <div>
          <label htmlFor="report-details" className="block text-xs font-medium text-black/70 mb-1">
            Anything else we should know? (optional)
          </label>
          <textarea
            id="report-details"
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, MAX_DETAILS))}
            rows={3}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
          <p className="text-[10px] text-black/40 text-right">{details.length}/{MAX_DETAILS}</p>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-black bg-white/5 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
            {submitting ? 'Sending…' : 'Report'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ReportDialog;
