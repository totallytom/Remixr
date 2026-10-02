import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, X, Undo2, Play, Pause, Eye, EyeOff, Shuffle, Keyboard } from 'lucide-react';
import { SwipeStack, type SwipeStackHandle } from '../components/music/SwipeStack';
import SessionPanel, { EMPTY_SESSION, type DiscoverSession } from '../components/discover/SessionPanel';
import { usePreviewPlayer } from '../hooks/usePreviewPlayer';
import { BrutalToggle, Sticker, hardShadow } from '../components/ui/brutal';
import { useStore } from '../store/useStore';
import type { Track } from '../store/useStore';
import { MusicService } from '../services/musicService';

function shuffleTracks<T>(array: T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SESSION_KEY = 'rmx_discover_session';
const PREFS_KEY = 'rmx_discover_prefs';

function readJSON<T>(storage: Storage | undefined, key: string, fallback: T): T {
  try {
    const raw = storage?.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(storage: Storage | undefined, key: string, value: unknown) {
  try { storage?.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

type Mode = 'classic' | 'blind';

const Discover: React.FC = () => {
  const { addToQueue, playTrack, user: currentUser } = useStore();
  const navigate = useNavigate();
  const deckRef = useRef<SwipeStackHandle>(null);

  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [topTrack, setTopTrack] = useState<Track | null>(null);

  const [prefs, setPrefs] = useState(() =>
    readJSON(typeof window !== 'undefined' ? window.localStorage : undefined, PREFS_KEY, { mode: 'classic' as Mode, autoPlay: true }),
  );
  const [session, setSession] = useState<DiscoverSession>(() =>
    readJSON(typeof window !== 'undefined' ? window.sessionStorage : undefined, SESSION_KEY, EMPTY_SESSION),
  );
  const [reveal, setReveal] = useState<Track | null>(null);
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => writeJSON(window.localStorage, PREFS_KEY, prefs), [prefs]);
  useEffect(() => writeJSON(window.sessionStorage, SESSION_KEY, session), [session]);

  const blind = prefs.mode === 'blind';
  const player = usePreviewPlayer();
  // Browsers only allow sound after the user has interacted with the page.
  const interactedRef = useRef(false);
  useEffect(() => {
    const mark = () => { interactedRef.current = true; };
    window.addEventListener('pointerdown', mark, { once: true });
    window.addEventListener('keydown', mark, { once: true });
    return () => {
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('keydown', mark);
    };
  }, []);

  // ── Data ──
  useEffect(() => {
    MusicService.getAvailableGenres()
      .then(setAvailableGenres)
      .catch(() => setAvailableGenres(['Electronic', 'Pop', 'Rock', 'Hip Hop', 'R&B', 'Jazz', 'Classical']));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoadingTracks(true);
      try {
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Load timeout')), 15000));
        const tracks = await Promise.race([
          selectedGenre ? MusicService.getTracksByGenre(selectedGenre, 16, 0) : MusicService.getTracks(16),
          timeout,
        ]);
        if (!cancelled) setAllTracks(shuffleTracks(tracks).slice(0, 16));
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load tracks:', error);
          setAllTracks([]);
        }
      } finally {
        if (!cancelled) setIsLoadingTracks(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedGenre]);

  // ── Auto-play the top card's preview ──
  const handleTopChange = useCallback((track: Track | null) => {
    setTopTrack(track);
    if (track && (prefs.autoPlay || blind) && interactedRef.current) player.play(track);
    else player.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.autoPlay, blind]);

  // Stop the preview when leaving the page.
  useEffect(() => () => player.stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Swipes ──
  const handleSwipe = useCallback(
    (direction: 'left' | 'right', track: Track) => {
      if (direction === 'right') {
        addToQueue(track);
        if (currentUser) {
          MusicService.recordPlayHistory(currentUser.id, track.id, 0, false).catch(console.error);
          MusicService.addTrackLike(track.id, currentUser.id).catch(() => {});
        }
        setSession((s) => {
          const streak = s.streak + 1;
          return {
            ...s,
            liked: s.liked.some((t) => t.id === track.id) ? s.liked : [...s.liked, track].slice(-50),
            streak,
            bestStreak: Math.max(s.bestStreak, streak),
          };
        });
        if (blind) setReveal(track);
      } else {
        setSession((s) => ({ ...s, skipped: s.skipped + 1, streak: 0 }));
      }
    },
    [addToQueue, currentUser, blind],
  );

  const playbackFor = useCallback((track: Track) => ({
    isCurrent: player.trackId === track.id,
    isPlaying: player.trackId === track.id && player.isPlaying,
    progress: player.trackId === track.id ? player.progress : 0,
    onToggle: () => { interactedRef.current = true; player.toggle(track); },
    getAnalyser: player.getAnalyser,
  }), [player]);

  const togglePlayTop = useCallback(() => {
    if (!topTrack) return;
    interactedRef.current = true;
    player.toggle(topTrack);
  }, [topTrack, player]);

  // ── Keyboard: ← skip, → like, space play/pause, backspace / ↓ undo ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); deckRef.current?.swipe('right'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); deckRef.current?.swipe('left'); }
      else if (e.key === ' ') { e.preventDefault(); togglePlayTop(); }
      else if (e.key === 'Backspace' || e.key === 'ArrowDown') { e.preventDefault(); deckRef.current?.back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlayTop]);

  const setMode = (mode: Mode) => {
    interactedRef.current = true;
    setPrefs((p) => ({ ...p, mode }));
    setReveal(null);
    if (mode === 'blind' && topTrack) player.play(topTrack);
  };

  const surpriseMe = () => {
    if (availableGenres.length === 0) return;
    const options = availableGenres.filter((g) => g !== selectedGenre);
    setSelectedGenre(options[Math.floor(Math.random() * options.length)] ?? null);
  };

  const topPlaying = Boolean(topTrack && player.trackId === topTrack.id && player.isPlaying);

  return (
    <div
      className="min-h-full bg-[#faf6ec] px-3 pt-3 pb-32 lg:px-6 lg:py-6"
      style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.07) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
    >
      {!currentUser && (
        <div className="max-w-6xl mx-auto mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border-2 border-black bg-yellow-300" style={hardShadow(3)}>
          <p className="text-sm font-semibold text-black min-w-0">Sign up to save your likes and build your taste profile.</p>
          <button
            onClick={() => navigate('/signup')}
            className="flex-shrink-0 px-4 py-1.5 rounded-xl border-2 border-black bg-black text-white text-xs font-bold"
          >
            Sign up free
          </button>
        </div>
      )}

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-8">
        {/* ── Deck column ── */}
        <div className="min-w-0">
          <header className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h1 className="font-kotra text-4xl lg:text-5xl text-black leading-none">Discover</h1>
              <p className="text-sm text-black/60 mt-1">
                {blind ? 'Blind mode — no covers, no names. Just the sound.' : 'Swipe right to keep it, left to skip it.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Mode switch */}
              <div className="inline-flex p-1 bg-white border-2 border-black rounded-xl" style={hardShadow(3)} role="radiogroup" aria-label="Discover mode">
                {([
                  { id: 'classic', label: 'Classic', icon: Eye },
                  { id: 'blind', label: 'Blind', icon: EyeOff },
                ] as const).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={prefs.mode === id}
                    onClick={() => setMode(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                      prefs.mode === id ? 'bg-black text-white' : 'text-black hover:bg-teal-50'
                    }`}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-black">
                Auto-play
                <BrutalToggle
                  label="Auto-play previews"
                  checked={prefs.autoPlay || blind}
                  disabled={blind}
                  onChange={(v) => {
                    interactedRef.current = true;
                    setPrefs((p) => ({ ...p, autoPlay: v }));
                    if (v && topTrack) player.play(topTrack);
                  }}
                />
              </label>
            </div>
          </header>

          {/* Genres */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-3 -mx-1 px-1">
            <button
              type="button"
              onClick={surpriseMe}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-black bg-yellow-300 text-sm font-bold text-black shadow-[2px_2px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              <Shuffle size={14} /> Surprise me
            </button>
            {[null, ...availableGenres].map((genre) => {
              const active = selectedGenre === genre;
              return (
                <button
                  key={genre ?? 'all'}
                  type="button"
                  onClick={() => setSelectedGenre(genre)}
                  aria-pressed={active}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl border-2 border-black text-sm font-bold transition-all ${
                    active ? 'bg-black text-white' : 'bg-white text-black shadow-[2px_2px_0_0_#000] hover:bg-teal-50'
                  }`}
                >
                  {genre ?? 'All'}
                </button>
              );
            })}
          </div>

          {/* Deck */}
          <section aria-label="Track deck" className="relative mx-auto w-full max-w-sm h-[50vh] min-h-[340px] max-h-[600px] lg:h-[58vh] lg:min-h-[420px]">
            {isLoadingTracks ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-3xl border-2 border-black bg-white" style={hardShadow(8)}>
                <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <SwipeStack
                ref={deckRef}
                initialTracks={allTracks}
                onSwipe={handleSwipe}
                genre={selectedGenre}
                resetKey={selectedGenre ?? 'all'}
                onTopChange={handleTopChange}
                playbackFor={playbackFor}
                blind={blind}
              />
            )}
          </section>

          {/* Actions */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => deckRef.current?.back()}
              className="w-11 h-11 rounded-full border-2 border-black bg-white flex items-center justify-center shadow-[3px_3px_0_0_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all"
              aria-label="Undo last swipe"
              title="Undo (Backspace)"
            >
              <Undo2 size={18} />
            </button>
            <button
              type="button"
              onClick={() => deckRef.current?.swipe('left')}
              disabled={!topTrack}
              className="w-16 h-16 rounded-full border-2 border-black bg-red-300 flex items-center justify-center shadow-[4px_4px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-40"
              aria-label="Skip"
              title="Skip (←)"
            >
              <X size={28} strokeWidth={3} />
            </button>
            <button
              type="button"
              onClick={togglePlayTop}
              disabled={!topTrack?.audioUrl}
              className="w-12 h-12 rounded-full border-2 border-black bg-white flex items-center justify-center shadow-[3px_3px_0_0_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all disabled:opacity-40"
              aria-label={topPlaying ? 'Pause preview' : 'Play preview'}
              title="Play / pause (Space)"
            >
              {topPlaying ? <Pause size={20} /> : <Play size={20} className="fill-black" />}
            </button>
            <button
              type="button"
              onClick={() => deckRef.current?.swipe('right')}
              disabled={!topTrack}
              className="w-16 h-16 rounded-full border-2 border-black bg-green-300 flex items-center justify-center shadow-[4px_4px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-40"
              aria-label="Like"
              title="Like (→)"
            >
              <Heart size={28} className="fill-black" />
            </button>
            <button
              type="button"
              onClick={() => setShowKeys((v) => !v)}
              className="hidden lg:flex w-11 h-11 rounded-full border-2 border-black bg-white items-center justify-center shadow-[3px_3px_0_0_#000]"
              aria-label="Keyboard shortcuts"
              aria-expanded={showKeys}
            >
              <Keyboard size={18} />
            </button>
          </div>
          {showKeys && (
            <p className="hidden lg:block mt-4 text-center text-xs text-black/60">
              <kbd className="px-1.5 border border-black rounded">←</kbd> skip ·{' '}
              <kbd className="px-1.5 border border-black rounded">→</kbd> like ·{' '}
              <kbd className="px-1.5 border border-black rounded">Space</kbd> play/pause ·{' '}
              <kbd className="px-1.5 border border-black rounded">Backspace</kbd> undo
            </p>
          )}
          {session.streak >= 5 && (
            <div className="mt-4 flex justify-center">
              <Sticker rotate={-3} className="!bg-orange-300">🔥 {session.streak} likes in a row</Sticker>
            </div>
          )}
        </div>

        {/* ── Session column ── */}
        <SessionPanel
          session={session}
          reveal={blind ? reveal : null}
          activeGenre={selectedGenre}
          onPlay={(t) => { player.stop(); playTrack(t); }}
          onDigDeeper={(g) => setSelectedGenre(g)}
          onReset={() => { setSession(EMPTY_SESSION); setReveal(null); }}
        />
      </div>
    </div>
  );
};

export default Discover;
