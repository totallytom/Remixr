import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Download, Lock, Loader2, UserPlus, LogIn, Settings2 } from 'lucide-react';
import { BrutalButton, BrutalToggle, hardShadow } from '../ui/brutal';
import { RemixService } from '../../services/remixService';
import {
  DownloadService,
  DOWNLOAD_POLICY_OPTIONS,
  type DownloadAccess,
  type DownloadPolicy,
} from '../../services/downloadService';
import { STOREFRONT_SALES_ENABLED } from '../../config/storefrontPolicy';
import { LICENSES, licenseInfo, DEFAULT_LICENSE, type LicenseType } from '../../config/licenses';
import { HypeService, formatHypeTime, type HypeMap } from '../../services/hypeService';
import { HypeStrip } from '../player/Hype';

interface DownloadDialogProps {
  trackId: string;
  trackTitle: string;
  onClose: () => void;
}

const DENIED_COPY: Record<string, string> = {
  not_found: 'This track no longer exists.',
  unavailable: 'This track isn’t available right now.',
  off: 'The artist keeps this one for streaming only.',
  sign_in: 'Sign in to download tracks the artist has shared.',
  follow: 'This download is a reward for followers.',
  buy: 'This track is downloadable after you buy it.',
};

/**
 * Track download, under the artist's control. Artists see their download
 * settings and count; listeners see a download button or why they can't.
 */
const DownloadDialog: React.FC<DownloadDialogProps> = ({ trackId, trackTitle, onClose }) => {
  const navigate = useNavigate();
  const [access, setAccess] = useState<DownloadAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [policy, setPolicy] = useState<DownloadPolicy>('off');
  const [license, setLicense] = useState<LicenseType>(DEFAULT_LICENSE);
  const [savedLicense, setSavedLicense] = useState<LicenseType>(DEFAULT_LICENSE);
  const [allowRemix, setAllowRemix] = useState(false);
  const [savedAllowRemix, setSavedAllowRemix] = useState(false);
  const [hypeMap, setHypeMap] = useState<HypeMap | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    DownloadService.getAccess(trackId)
      .then((a) => {
        if (cancelled) return;
        setAccess(a);
        if (a.policy) setPolicy(a.policy);
        if (a.reason === 'owner' || a.reason === 'admin') {
          DownloadService.getLicense(trackId)
            .then((l) => { if (!cancelled) { setLicense(l); setSavedLicense(l); } })
            .catch(() => {});
          RemixService.getAllowRemix(trackId)
            .then((v) => { if (!cancelled) { setAllowRemix(v); setSavedAllowRemix(v); } })
            .catch(() => {});
          HypeService.getMap(trackId)
            .then((m) => { if (!cancelled) setHypeMap(m); })
            .catch(() => {});
        }
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not check download access'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [trackId]);

  const isOwner = access?.reason === 'owner' || access?.reason === 'admin';

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await DownloadService.download(trackId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await DownloadService.saveSettings(trackId, { policy, license, allowRemix });
      setAccess((a) => (a ? { ...a, policy } : a));
      setSavedLicense(license);
      setSavedAllowRemix(allowRemix);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isOwner ? 'Track settings' : 'Download track'}
        className="w-full sm:max-w-md bg-[#faf6ec] border-2 border-black rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        style={hardShadow(8)}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-black/60 flex items-center gap-1.5">
              {isOwner ? <><Settings2 size={12} /> Track settings</> : <><Download size={12} /> Download</>}
            </p>
            <p className="font-kotra text-2xl text-black leading-tight truncate">{trackTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg border-2 border-black bg-white" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
        ) : !access ? (
          <p className="text-sm font-semibold text-red-600">{error ?? 'Something went wrong.'}</p>
        ) : isOwner ? (
          /* ── Artist: who can download ── */
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-wide text-black/70 mb-1.5">Who can download this track?</legend>
              {DOWNLOAD_POLICY_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 border-black cursor-pointer transition-colors ${policy === o.value ? 'bg-teal-300' : 'bg-white hover:bg-teal-50'}`}
                >
                  <input
                    type="radio"
                    name="download-policy"
                    value={o.value}
                    checked={policy === o.value}
                    onChange={() => setPolicy(o.value)}
                    className="mt-1 accent-black"
                  />
                  <span>
                    <span className="block text-sm font-bold text-black">{o.label}</span>
                    <span className="block text-xs text-black/60">{o.detail}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {policy === 'paid' && !STOREFRONT_SALES_ENABLED && (
              <p className="text-xs p-2.5 rounded-lg border-2 border-black bg-yellow-200 text-black">
                Storefront sales are paused right now, so only people who already bought it can download.
              </p>
            )}

            <p className="text-[11px] text-black/50">
              This controls the official download. Anyone listening still streams the track in their browser.
            </p>

            <div>
              <label htmlFor="track-license" className="block text-xs font-bold uppercase tracking-wide text-black/70 mb-1.5">
                Licence
              </label>
              <select
                id="track-license"
                value={license}
                onChange={(e) => setLicense(e.target.value as LicenseType)}
                className="w-full px-3 py-2.5 bg-white border-2 border-black rounded-xl text-sm text-black focus:outline-none focus:shadow-[3px_3px_0_0_#000]"
              >
                {LICENSES.map((l) => <option key={l.value} value={l.value}>{l.short === l.name ? l.name : `${l.short} — ${l.name}`}</option>)}
              </select>
              <p className="text-xs text-black/60 mt-1.5">
                {licenseInfo(license).summary}{' '}
                {licenseInfo(license).url && (
                  <a href={licenseInfo(license).url} target="_blank" rel="noopener noreferrer" className="underline">Read the licence</a>
                )}
              </p>
              {license !== 'all_rights_reserved' && (
                <p className="text-[11px] text-black/50 mt-1">
                  Creative Commons licences can't be taken back for copies people already have, so choose carefully.
                </p>
              )}
            </div>

            <div className="flex items-start justify-between gap-3 p-3 rounded-xl border-2 border-black bg-white">
              <span>
                <span className="block text-sm font-bold text-black">Allow remixes</span>
                <span className="block text-xs text-black/60">
                  {licenseInfo(license).allowsRemix
                    ? 'Your licence already lets anyone remix this in the Remix Studio, with credit to you.'
                    : 'Let other artists use this track in the Remix Studio. Remixes always credit you, and you get notified.'}
                </span>
              </span>
              <BrutalToggle
                label="Allow remixes"
                checked={allowRemix || licenseInfo(license).allowsRemix}
                disabled={licenseInfo(license).allowsRemix}
                onChange={setAllowRemix}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <BrutalButton onClick={handleSave} disabled={saving || (policy === access.policy && license === savedLicense && allowRemix === savedAllowRemix)}>
                {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
              </BrutalButton>
              <BrutalButton tone="white" onClick={handleDownload} disabled={downloading}>
                <Download size={16} /> {downloading ? 'Preparing…' : 'Download my file'}
              </BrutalButton>
            </div>

            {typeof access.downloads === 'number' && (
              <p className="text-sm text-black">
                <span className="font-kotra text-2xl">{access.downloads}</span>{' '}
                download{access.downloads === 1 ? '' : 's'} by listeners so far
              </p>
            )}

            {/* Hype map — where listeners tapped 🔥 */}
            <div className="p-3 rounded-xl border-2 border-black bg-white">
              <p className="text-xs font-bold uppercase tracking-wide text-black/70 mb-2">🔥 Hype map</p>
              {hypeMap && hypeMap.total > 0 ? (
                <>
                  <HypeStrip map={hypeMap} height={36} className="mt-4" />
                  <div className="h-1.5 rounded-full bg-black/10 mt-1" />
                  <p className="text-sm text-black mt-2">
                    {hypeMap.total} hype{hypeMap.total === 1 ? '' : 's'} from {hypeMap.listeners} listener{hypeMap.listeners === 1 ? '' : 's'}
                    {hypeMap.peakSec != null && <> · biggest moment at <span className="font-bold">{formatHypeTime(hypeMap.peakSec)}</span></>}
                  </p>
                </>
              ) : (
                <p className="text-sm text-black/60">No hype yet. When listeners tap 🔥 during your track, you'll see where it hits hardest.</p>
              )}
            </div>
          </div>
        ) : access.allowed ? (
          /* ── Listener: allowed ── */
          <div className="space-y-4">
            <p className="text-sm text-black/70">
              {access.reason === 'purchased'
                ? 'You bought this track — download it as often as you like.'
                : access.reason === 'follower'
                  ? `Thanks for following @${access.artistUsername}! They’ve shared this download with followers.`
                  : `@${access.artistUsername} has made this track free to download.`}
            </p>
            <BrutalButton className="w-full" onClick={handleDownload} disabled={downloading}>
              <Download size={16} /> {downloading ? 'Preparing…' : 'Download'}
            </BrutalButton>
            <p className="text-[11px] text-black/50">
              For your personal listening. The artist keeps all rights unless they say otherwise.
            </p>
          </div>
        ) : (
          /* ── Listener: not allowed ── */
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl border-2 border-black bg-white">
              <Lock size={18} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm text-black">{DENIED_COPY[access.reason] ?? 'Downloads aren’t available for this track.'}</p>
            </div>
            {access.reason === 'sign_in' && (
              <BrutalButton className="w-full" onClick={() => { onClose(); navigate('/login'); }}>
                <LogIn size={16} /> Sign in
              </BrutalButton>
            )}
            {access.reason === 'follow' && access.artistId && (
              <BrutalButton className="w-full" tone="teal" onClick={() => { onClose(); navigate(`/profile/${access.artistId}`); }}>
                <UserPlus size={16} /> Follow @{access.artistUsername}
              </BrutalButton>
            )}
            {access.reason === 'buy' && STOREFRONT_SALES_ENABLED && (
              <BrutalButton className="w-full" tone="teal" onClick={() => { onClose(); navigate('/storefront'); }}>
                Buy on the Storefront
              </BrutalButton>
            )}
            {access.reason === 'buy' && !STOREFRONT_SALES_ENABLED && (
              <p className="text-xs text-black/60">Storefront sales are paused right now — check back soon.</p>
            )}
          </div>
        )}

        {error && access && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </div>,
    document.body,
  );
};

export default DownloadDialog;
