import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Play, Pause, Plus, Layers, ZoomIn, ZoomOut, SkipBack, AlertTriangle, Loader2, Check, ImagePlus, Info, Upload,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { BrutalButton, brutalInput, hardShadow } from '../components/ui/brutal';
import { Timeline, LANE_COLORS } from '../components/remix/Timeline';
import SourcePicker from '../components/remix/SourcePicker';
import { BASIS_LABEL } from '../components/remix/RemixCredits';
import LicenseBadge from '../components/music/LicenseBadge';
import {
  MAX_LAYERS, MAX_REMIX_SEC, MixPlayer, clipLength, computePeaks, encodeMp3, fmtTime, loadBuffer, mixLength, renderMix,
  type Layer, type SourceTrack,
} from '../components/remix/engine';
import { RemixService, type RemixTerms } from '../services/remixService';
import { DOWNLOAD_POLICY_OPTIONS, type DownloadPolicy } from '../services/downloadService';
import { licenseInfo, type LicenseType } from '../config/licenses';

const GENRES = [
  'Electronic', 'Pop', 'Rock', 'Hip Hop', 'R&B', 'Jazz', 'Classical',
  'Country', 'Folk', 'Alternative', 'Experimental', 'Reggae', 'Blues',
];
const MIN_REMIX_SEC = 5;

type Step = 'render' | 'encode' | 'check' | 'upload' | 'cover' | 'save';
const STEP_LABEL: Record<Step, string> = {
  render: 'Mixing down',
  encode: 'Encoding MP3',
  check: 'Copyright check',
  upload: 'Uploading',
  cover: 'Uploading cover',
  save: 'Publishing',
};

let keySeq = 0;

// ─── Small pieces ────────────────────────────────────────────────────────────
const Panel: React.FC<{ title?: string; className?: string; children: React.ReactNode; right?: React.ReactNode }> = ({ title, className = '', children, right }) => (
  <section className={`bg-white border-2 border-black rounded-2xl ${className}`} style={hardShadow(4)}>
    {title && (
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="!text-base !font-bold !m-0 text-black">{title}</h2>
        {right}
      </header>
    )}
    {children}
  </section>
);

const Slider: React.FC<{
  label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void;
}> = ({ label, value, min, max, step, format, onChange }) => (
  <label className="block">
    <span className="flex items-center justify-between text-xs font-semibold text-black/70 mb-1">
      {label} <span className="tabular-nums text-black">{format(value)}</span>
    </span>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-black"
    />
  </label>
);

const NumberField: React.FC<{ label: string; value: number; min: number; max: number; onChange: (v: number) => void }> = ({ label, value, min, max, onChange }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-black/70 mb-1">{label}</span>
    <input
      type="number" min={min} max={max} step={0.1} value={Number(value.toFixed(2))}
      onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v))); }}
      className="w-full px-3 py-2 bg-white border-2 border-black rounded-lg text-sm tabular-nums focus:outline-none focus:shadow-[2px_2px_0_0_#000]"
    />
  </label>
);

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Remix() {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, player: globalPlayer, pauseTrack } = useStore();

  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const mixer = useRef<MixPlayer | null>(null);
  mixer.current ??= new MixPlayer();

  const [terms, setTerms] = useState<RemixTerms | null>(null);
  const [termsLoading, setTermsLoading] = useState(false);

  const artistName = (user as { artistName?: string } | null)?.artistName || user?.username || 'Artist';
  const [title, setTitle] = useState('');
  const titleTouched = useRef(false);
  const [genre, setGenre] = useState('Electronic');
  const [license, setLicense] = useState<LicenseType>('all_rights_reserved');
  const [downloadPolicy, setDownloadPolicy] = useState<DownloadPolicy>('off');
  const [cover, setCover] = useState<File | null>(null);
  const coverPreview = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);
  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview); }, [coverPreview]);

  const [step, setStep] = useState<Step | null>(null);
  const [encodePct, setEncodePct] = useState(0);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; status: 'published' | 'pending_review' } | null>(null);

  const length = mixLength(layers);
  const selected = layers.find((l) => l.key === selectedKey) ?? null;
  const sourceIds = useMemo(() => layers.map((l) => l.track.id), [layers]);
  const sourceKey = sourceIds.join(',');
  const allReady = layers.length > 0 && layers.every((l) => l.status === 'ready');

  // ── Layers ──
  const patchLayer = useCallback((key: string, patch: Partial<Layer>) => {
    setLayers((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);

  const addSource = useCallback((t: SourceTrack) => {
    const key = `layer-${++keySeq}`;
    setLayers((ls) => {
      if (ls.length >= MAX_LAYERS || ls.some((l) => l.track.id === t.id)) return ls;
      return [...ls, {
        key, track: t, status: 'loading', offset: 0, trimStart: 0, trimEnd: Math.min(t.duration || MAX_REMIX_SEC, MAX_REMIX_SEC),
        gain: 1, fadeIn: 0, fadeOut: 0, muted: false, solo: false,
      }];
    });
    setSelectedKey(key);
    loadBuffer(t.audioUrl)
      .then((buffer) => patchLayer(key, {
        status: 'ready', buffer, peaks: computePeaks(buffer), trimEnd: Math.min(buffer.duration, MAX_REMIX_SEC),
      }))
      .catch((e) => patchLayer(key, { status: 'error', error: e instanceof Error ? e.message : 'Could not load audio' }));
  }, [patchLayer]);

  const removeLayer = useCallback((key: string) => {
    setLayers((ls) => ls.filter((l) => l.key !== key));
    setSelectedKey((k) => (k === key ? null : k));
  }, []);

  // Seed from /remix/:trackId.
  useEffect(() => {
    if (!trackId) return;
    let live = true;
    RemixService.getSource(trackId)
      .then((t) => {
        if (!live) return;
        if (t) addSource(t);
        else setSeedError('That track isn’t available to remix.');
      })
      .catch(() => live && setSeedError('Couldn’t load that track.'));
    return () => { live = false; };
  }, [trackId, addSource]);

  // Default title from the first source until the user edits it.
  useEffect(() => {
    if (titleTouched.current) return;
    const first = layers[0]?.track;
    setTitle(first ? `${first.title} (${artistName} Remix)`.slice(0, 200) : '');
  }, [layers[0]?.track.id, artistName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Terms (who may be remixed, which licence the remix may use) ──
  useEffect(() => {
    if (!isAuthenticated || sourceIds.length === 0) { setTerms(null); return; }
    let live = true;
    setTermsLoading(true);
    RemixService.getTerms(sourceIds)
      .then((t) => {
        if (!live) return;
        setTerms(t);
        if (t.ok) {
          setLicense((cur) => (t.allowedLicenses.includes(cur) ? cur : t.allowedLicenses[0]));
          if (!t.allowPaid) setDownloadPolicy((p) => (p === 'paid' ? 'off' : p));
        }
      })
      .catch((e) => live && setTerms({ ok: false, error: e instanceof Error ? e.message : 'Could not check permissions', sources: [], allowedLicenses: [], allowPaid: false }))
      .finally(() => live && setTermsLoading(false));
    return () => { live = false; };
  }, [sourceKey, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Playback ──
  const play = useCallback(async (from?: number) => {
    if (!allReady || length <= 0) return;
    if (globalPlayer?.isPlaying) pauseTrack();
    const start = from ?? (pos >= length - 0.05 ? 0 : pos);
    await mixer.current!.play(layers, start);
    setPlaying(true);
  }, [allReady, length, layers, pos, globalPlayer?.isPlaying, pauseTrack]);

  const pause = useCallback(() => {
    mixer.current!.pause();
    setPos(mixer.current!.position());
    setPlaying(false);
  }, []);

  const seek = useCallback((sec: number) => {
    const s = Math.max(0, Math.min(sec, length));
    setPos(s);
    if (playing) mixer.current!.play(layers, s);
    else mixer.current!.seek(s);
  }, [length, playing, layers]);

  // Move the playhead while playing; stop at the end.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const p = mixer.current!.position();
      if (p >= length) {
        mixer.current!.pause();
        mixer.current!.seek(0);
        setPos(0);
        setPlaying(false);
        return;
      }
      setPos(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, length]);

  // Edits while playing: re-schedule from the current position (debounced for drags).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (!playing) return;
    const t = setTimeout(() => mixer.current!.play(layers, mixer.current!.position()), 120);
    return () => clearTimeout(t);
  }, [layers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => mixer.current?.dispose(), []);

  // Space toggles playback (outside form fields).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code !== 'Space' || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName) || el.isContentEditable) return;
      e.preventDefault();
      if (playing) pause(); else play();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, play, pause]);

  // ── Publish ──
  const blockedId = terms && !terms.ok ? terms.trackId : undefined;
  const publishProblem =
    !isAuthenticated ? 'Sign in to publish'
    : layers.length === 0 ? 'Add a track to start'
    : !allReady ? 'Waiting for audio to load'
    : termsLoading ? 'Checking permissions…'
    : terms && !terms.ok ? terms.error || 'This remix isn’t allowed'
    : length < MIN_REMIX_SEC ? `Make it at least ${MIN_REMIX_SEC} seconds long`
    : !title.trim() ? 'Give your remix a title'
    : null;

  const publish = async () => {
    if (publishProblem || !user) return;
    if (playing) pause();
    setPublishError(null);
    try {
      setStep('render');
      const mixed = await renderMix(layers);
      setStep('encode');
      setEncodePct(0);
      const mp3 = await encodeMp3(mixed, setEncodePct);
      if (mp3.size > 50 * 1024 * 1024) throw new Error('The rendered file is over 50 MB. Shorten the remix and try again.');
      const res = await RemixService.publish({
        userId: user.id,
        audio: mp3,
        duration: mixed.duration,
        title: title.trim(),
        artist: artistName,
        genre,
        license,
        downloadPolicy,
        sourceIds,
        cover,
        onStep: setStep,
      });
      setResult(res);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Publishing failed');
    } finally {
      setStep(null);
    }
  };

  // ── Gates ──
  if (!isAuthenticated) {
    return (
      <div className="min-h-full bg-[#faf6ec] px-4 py-10 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border-2 border-black rounded-2xl p-8 text-center" style={hardShadow(6)}>
          <span className="w-14 h-14 rounded-2xl border-2 border-black bg-teal-300 flex items-center justify-center mx-auto mb-5"><Layers size={26} /></span>
          <h1 className="font-kotra text-3xl text-black mb-2">Remix Studio</h1>
          <p className="text-sm text-black/60 mb-6">Layer up to four tracks, shape them on a timeline and publish your remix to Re-Mixed.</p>
          <BrutalButton className="w-full" onClick={() => navigate('/signup')}>Sign up free</BrutalButton>
          <BrutalButton tone="white" className="w-full mt-3" onClick={() => navigate('/login')}>Sign in</BrutalButton>
        </div>
      </div>
    );
  }

  if (result) {
    const live = result.status === 'published';
    return (
      <div className="min-h-full bg-[#faf6ec] px-4 py-10 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border-2 border-black rounded-2xl p-8 text-center" style={hardShadow(6)}>
          <span className={`w-14 h-14 rounded-2xl border-2 border-black flex items-center justify-center mx-auto mb-5 ${live ? 'bg-teal-300' : 'bg-yellow-300'}`}>
            {live ? <Check size={28} /> : <Info size={26} />}
          </span>
          <h1 className="font-kotra text-3xl text-black mb-2">{live ? 'Your remix is live' : 'Sent for review'}</h1>
          <p className="text-sm text-black/60 mb-6">
            {live
              ? `“${title.trim()}” is now on Home, Discover and Search, with credits to the original artists.`
              : `“${title.trim()}” will appear once it’s been reviewed. This happens when an account has an active copyright strike.`}
          </p>
          <BrutalButton className="w-full" onClick={() => navigate(`/profile/${user?.id}`)}>View on your profile</BrutalButton>
          <BrutalButton tone="white" className="w-full mt-3" onClick={() => navigate('/discover')}>Go to Discover</BrutalButton>
          <button type="button" className="mt-4 text-sm font-semibold underline text-black/70" onClick={() => window.location.assign('/remix')}>
            Start another remix
          </button>
        </div>
      </div>
    );
  }

  const busy = step !== null;

  return (
    <div className="min-h-full bg-[#faf6ec] px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="font-kotra text-4xl text-black leading-none">Remix Studio</h1>
          <p className="text-sm text-black/60 mt-1">Layer up to {MAX_LAYERS} tracks, line them up, shape the fades, then publish.</p>
        </header>

        {seedError && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border-2 border-black bg-red-100 px-4 py-3 text-sm font-semibold text-red-800">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> {seedError}
          </div>
        )}

        {/* ── Transport ── */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => (playing ? pause() : play())}
            disabled={!allReady || length <= 0 || busy}
            aria-label={playing ? 'Pause preview' : 'Play preview'}
            className="w-12 h-12 rounded-full border-2 border-black bg-black text-white flex items-center justify-center shadow-[3px_3px_0_0_#0d9488] disabled:opacity-40"
          >
            {playing ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => seek(0)}
            disabled={busy}
            aria-label="Back to start"
            className="w-10 h-10 rounded-full border-2 border-black bg-white flex items-center justify-center"
          >
            <SkipBack size={16} />
          </button>
          <p className="font-bold tabular-nums text-black text-lg">
            {fmtTime(pos)} <span className="text-black/40 font-semibold">/ {fmtTime(length)}</span>
          </p>
          <div className="flex-1" />
          <div className="inline-flex items-center border-2 border-black rounded-xl bg-white overflow-hidden">
            <button type="button" onClick={() => setZoom((z) => Math.max(1, z / 2))} disabled={zoom <= 1} aria-label="Zoom out" className="px-2.5 py-2 disabled:opacity-30"><ZoomOut size={16} /></button>
            <span className="px-1 text-xs font-bold tabular-nums w-8 text-center">{zoom}×</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(16, z * 2))} disabled={zoom >= 16} aria-label="Zoom in" className="px-2.5 py-2 disabled:opacity-30"><ZoomIn size={16} /></button>
          </div>
          <BrutalButton size="sm" tone="teal" onClick={() => setPickerOpen(true)} disabled={layers.length >= MAX_LAYERS || busy}>
            <Plus size={14} /> Add track {layers.length > 0 && `(${layers.length}/${MAX_LAYERS})`}
          </BrutalButton>
        </div>

        {/* ── Timeline ── */}
        <Panel className="overflow-hidden mb-6">
          {layers.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Layers size={32} className="mx-auto mb-3 text-black/30" />
              <p className="font-bold text-black">No tracks yet</p>
              <p className="text-sm text-black/60 mt-1 mb-5">Pick a track to start. You can stack up to {MAX_LAYERS} on top of each other.</p>
              <BrutalButton tone="teal" onClick={() => setPickerOpen(true)}><Plus size={16} /> Add a track</BrutalButton>
            </div>
          ) : (
            <Timeline
              layers={layers}
              position={pos}
              length={length}
              zoom={zoom}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              onChange={patchLayer}
              onRemove={removeLayer}
              onSeek={seek}
            />
          )}
        </Panel>
        {layers.length > 0 && (
          <p className="-mt-4 mb-6 text-xs text-black/60">
            Drag a clip to move it, drag its edges to trim. Arrow keys nudge the selected clip (Shift for bigger steps). Space plays/pauses. Max {fmtTime(MAX_REMIX_SEC)}.
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Layer inspector ── */}
          <Panel title={selected ? 'Layer' : 'Layer settings'} className="lg:col-span-2 self-start">
            <div className="px-5 pb-5">
              {!selected ? (
                <p className="text-sm text-black/60">Select a clip to change its volume, fades and timing.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-sm border-2 border-black flex-shrink-0" style={{ background: LANE_COLORS[layers.indexOf(selected) % LANE_COLORS.length] }} />
                    <p className="text-sm font-bold text-black truncate">{selected.track.title}</p>
                    <span className="text-xs text-black/60 truncate">· {selected.track.artist}</span>
                  </div>
                  <Slider label="Volume" value={selected.gain} min={0} max={1.5} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchLayer(selected.key, { gain: v })} />
                  <Slider label="Fade in" value={selected.fadeIn} min={0} max={Math.min(15, clipLength(selected) / 2)} step={0.1} format={(v) => `${v.toFixed(1)}s`} onChange={(v) => patchLayer(selected.key, { fadeIn: v })} />
                  <Slider label="Fade out" value={selected.fadeOut} min={0} max={Math.min(15, clipLength(selected) / 2)} step={0.1} format={(v) => `${v.toFixed(1)}s`} onChange={(v) => patchLayer(selected.key, { fadeOut: v })} />
                  <div className="grid grid-cols-3 gap-2">
                    <NumberField label="Starts at (s)" value={selected.offset} min={0} max={MAX_REMIX_SEC - clipLength(selected)} onChange={(v) => patchLayer(selected.key, { offset: v })} />
                    <NumberField label="Clip in (s)" value={selected.trimStart} min={0} max={selected.trimEnd - 1} onChange={(v) => patchLayer(selected.key, { trimStart: v })} />
                    <NumberField
                      label="Clip out (s)" value={selected.trimEnd} min={selected.trimStart + 1}
                      max={Math.min(selected.buffer?.duration ?? selected.track.duration, selected.trimStart + MAX_REMIX_SEC - selected.offset)}
                      onChange={(v) => patchLayer(selected.key, { trimEnd: v })}
                    />
                  </div>
                  <p className="text-xs text-black/50">Clip length {fmtTime(clipLength(selected))} of {fmtTime(selected.buffer?.duration ?? selected.track.duration)}.</p>
                </div>
              )}
            </div>
          </Panel>

          {/* ── Publish ── */}
          <Panel title="Publish" className="lg:col-span-3">
            <div className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-[96px_1fr] gap-4">
                <label className="relative w-24 h-24 rounded-xl border-2 border-dashed border-black bg-black/[0.03] flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Cover preview" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <>
                      <ImagePlus size={20} className="text-black/50" />
                      <span className="text-[10px] font-semibold text-black/60 mt-1">Cover<br />(optional)</span>
                    </>
                  )}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
                </label>
                <div className="space-y-3">
                  <label className="block">
                    <span className="block text-xs font-semibold text-black/70 mb-1">Title</span>
                    <input
                      value={title}
                      maxLength={200}
                      onChange={(e) => { titleTouched.current = true; setTitle(e.target.value); }}
                      className={brutalInput}
                      placeholder="Name your remix"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-black/70 mb-1">Genre</span>
                    <select value={genre} onChange={(e) => setGenre(e.target.value)} className={brutalInput}>
                      {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-semibold text-black/70 mb-1">License</span>
                  <select
                    value={license}
                    onChange={(e) => setLicense(e.target.value as LicenseType)}
                    disabled={!terms?.ok}
                    className={brutalInput}
                  >
                    {(terms?.ok ? terms.allowedLicenses : [license]).map((l) => (
                      <option key={l} value={l}>{licenseInfo(l).name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-black/70 mb-1">Downloads</span>
                  <select value={downloadPolicy} onChange={(e) => setDownloadPolicy(e.target.value as DownloadPolicy)} className={brutalInput}>
                    {DOWNLOAD_POLICY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} disabled={o.value === 'paid' && terms?.allowPaid === false}>
                        {o.label}{o.value === 'paid' && terms?.allowPaid === false ? ' (not allowed: NonCommercial source)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {terms?.ok && terms.allowedLicenses.length < 8 && (
                <p className="flex items-start gap-1.5 text-xs text-black/70">
                  <Info size={14} className="mt-px flex-shrink-0" />
                  {terms.allowedLicenses.length === 1
                    ? `A ShareAlike track is in this mix, so the remix must use ${licenseInfo(terms.allowedLicenses[0]).short}.`
                    : 'A NonCommercial track is in this mix, so the remix must stay non-commercial.'}
                </p>
              )}

              {/* Credits */}
              {layers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-black/70 mb-1.5">Credits (shown on your remix)</p>
                  <ul className="space-y-1.5">
                    {layers.map((l, i) => {
                      const s = terms?.sources.find((x) => x.id === l.track.id);
                      const blocked = blockedId === l.track.id;
                      return (
                        <li key={l.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${blocked ? 'border-red-600 bg-red-50' : 'border-black/15 bg-black/[0.02]'}`}>
                          <span className="w-2.5 h-2.5 rounded-sm border border-black flex-shrink-0" style={{ background: LANE_COLORS[i % LANE_COLORS.length] }} />
                          <span className="text-sm text-black min-w-0 truncate"><b>{l.track.title}</b> by {l.track.artist}</span>
                          <span className="flex-1" />
                          {s && <span className="hidden sm:inline text-[11px] text-black/60">{BASIS_LABEL[s.basis]}</span>}
                          <LicenseBadge license={l.track.licenseType} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {terms && !terms.ok && (
                <div className="flex items-start gap-2 rounded-xl border-2 border-black bg-red-100 px-4 py-3 text-sm font-semibold text-red-800">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{terms.error}{blockedId ? ' Remove it to continue.' : ''}</span>
                </div>
              )}
              {publishError && (
                <div className="flex items-start gap-2 rounded-xl border-2 border-black bg-red-100 px-4 py-3 text-sm font-semibold text-red-800">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> {publishError}
                </div>
              )}

              {busy ? (
                <div className="rounded-xl border-2 border-black bg-teal-50 px-4 py-3" role="status" aria-live="polite">
                  <p className="flex items-center gap-2 text-sm font-bold text-black">
                    <Loader2 size={16} className="animate-spin" /> {STEP_LABEL[step!]}
                    {step === 'encode' && <span className="tabular-nums font-semibold text-black/60">{Math.round(encodePct * 100)}%</span>}
                  </p>
                  <p className="text-xs text-black/60 mt-1">Keep this tab open until it’s done.</p>
                </div>
              ) : (
                <div>
                  <BrutalButton className="w-full" onClick={publish} disabled={!!publishProblem}>
                    <Upload size={16} /> Publish remix
                  </BrutalButton>
                  {publishProblem && <p className="text-xs text-black/60 text-center mt-2">{publishProblem}</p>}
                  {!publishProblem && (
                    <p className="text-xs text-black/60 text-center mt-2">
                      Publishes to Home, Discover and Search. By publishing you confirm you added nothing you don’t have rights to.
                    </p>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {pickerOpen && (
        <SourcePicker
          usedIds={sourceIds}
          userId={user?.id}
          onPick={(t) => { addSource(t); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
