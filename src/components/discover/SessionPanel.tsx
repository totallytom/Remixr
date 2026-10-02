import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, Flame, Dna, Sparkles, Trash2 } from 'lucide-react';
import type { Track } from '../../store/useStore';
import { hardShadow } from '../ui/brutal';

export interface DiscoverSession {
  liked: Track[];
  skipped: number;
  streak: number;
  bestStreak: number;
}

export const EMPTY_SESSION: DiscoverSession = { liked: [], skipped: 0, streak: 0, bestStreak: 0 };

const DNA_COLORS = ['bg-teal-300', 'bg-yellow-300', 'bg-pink-300', 'bg-violet-300', 'bg-orange-300', 'bg-sky-300'];

interface SessionPanelProps {
  session: DiscoverSession;
  /** The last track liked in Blind mode, shown as a reveal. */
  reveal: Track | null;
  onPlay: (track: Track) => void;
  onDigDeeper: (genre: string) => void;
  onReset: () => void;
  activeGenre: string | null;
}

const SessionPanel: React.FC<SessionPanelProps> = ({ session, reveal, onPlay, onDigDeeper, onReset, activeGenre }) => {
  const dna = useMemo(() => {
    const counts = new Map<string, number>();
    session.liked.forEach((t) => {
      const g = t.genre || 'Other';
      counts.set(g, (counts.get(g) ?? 0) + 1);
    });
    const total = session.liked.length || 1;
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([genre, n], i) => ({ genre, pct: Math.round((n / total) * 100), color: DNA_COLORS[i % DNA_COLORS.length] }));
  }, [session.liked]);

  const topGenre = dna[0]?.genre;
  const likeRate = session.liked.length + session.skipped > 0
    ? Math.round((session.liked.length / (session.liked.length + session.skipped)) * 100)
    : null;

  return (
    <aside className="space-y-5">
      {/* Blind mode reveal */}
      <AnimatePresence mode="wait">
        {reveal && (
          <motion.div
            key={reveal.id}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
            className="flex items-center gap-3 p-3 rounded-2xl border-2 border-black bg-yellow-300"
            style={hardShadow(4)}
          >
            <img src={reveal.cover} alt="" className="w-14 h-14 rounded-xl border-2 border-black object-cover" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-black/70 flex items-center gap-1">
                <Sparkles size={12} /> Revealed
              </p>
              <p className="font-bold text-black truncate">{reveal.title}</p>
              <p className="text-sm text-black/70 truncate">{reveal.artist}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <section className="p-4 rounded-2xl border-2 border-black bg-white" style={hardShadow(4)}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="!text-base !font-bold !m-0 text-black">Your session</h3>
          {(session.liked.length > 0 || session.skipped > 0) && (
            <button type="button" onClick={onReset} className="text-xs font-bold text-black/50 hover:text-black flex items-center gap-1">
              <Trash2 size={12} /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border-2 border-black bg-green-300 py-2">
            <Heart size={14} className="mx-auto fill-black" />
            <p className="font-kotra text-2xl text-black leading-none mt-1">{session.liked.length}</p>
            <p className="text-[10px] font-bold uppercase text-black/70">Liked</p>
          </div>
          <div className="rounded-xl border-2 border-black bg-white py-2">
            <X size={14} className="mx-auto" strokeWidth={3} />
            <p className="font-kotra text-2xl text-black leading-none mt-1">{session.skipped}</p>
            <p className="text-[10px] font-bold uppercase text-black/70">Skipped</p>
          </div>
          <div className={`rounded-xl border-2 border-black py-2 ${session.streak >= 3 ? 'bg-orange-300' : 'bg-white'}`}>
            <Flame size={14} className="mx-auto" />
            <p className="font-kotra text-2xl text-black leading-none mt-1">{session.streak}</p>
            <p className="text-[10px] font-bold uppercase text-black/70">Streak</p>
          </div>
        </div>
        {likeRate !== null && (
          <p className="text-xs text-black/60 mt-3">
            You've liked {likeRate}% of what you heard{session.bestStreak >= 3 ? ` · best streak ${session.bestStreak} 🔥` : ''}.
          </p>
        )}
      </section>

      {/* Taste DNA */}
      <section className="p-4 rounded-2xl border-2 border-black bg-white" style={hardShadow(4)}>
        <h3 className="!text-base !font-bold !m-0 text-black flex items-center gap-2 mb-3">
          <Dna size={16} /> Taste DNA
        </h3>
        {dna.length === 0 ? (
          <p className="text-sm text-black/60">Like a few tracks and your taste profile builds here.</p>
        ) : (
          <>
            <div className="flex h-5 rounded-lg border-2 border-black overflow-hidden mb-3" aria-hidden="true">
              {dna.map((d) => (
                <div key={d.genre} className={`${d.color} border-r-2 border-black last:border-r-0 transition-[width] duration-300`} style={{ width: `${d.pct}%` }} />
              ))}
            </div>
            <ul className="space-y-1.5">
              {dna.map((d) => (
                <li key={d.genre} className="flex items-center gap-2 text-sm">
                  <span className={`w-3 h-3 rounded-sm border-2 border-black ${d.color}`} />
                  <span className="text-black flex-1 truncate">{d.genre}</span>
                  <span className="font-bold text-black">{d.pct}%</span>
                </li>
              ))}
            </ul>
            {topGenre && topGenre !== 'Other' && topGenre !== activeGenre && (
              <button
                type="button"
                onClick={() => onDigDeeper(topGenre)}
                className="mt-3 w-full px-3 py-2 rounded-xl border-2 border-black bg-teal-300 text-sm font-bold text-black shadow-[3px_3px_0_0_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all"
              >
                Dig deeper into {topGenre} →
              </button>
            )}
          </>
        )}
      </section>

      {/* Liked this session */}
      {session.liked.length > 0 && (
        <section className="p-4 rounded-2xl border-2 border-black bg-white" style={hardShadow(4)}>
          <h3 className="!text-base !font-bold !m-0 text-black mb-3">Liked this session</h3>
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {[...session.liked].reverse().map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onPlay(t)}
                  className="w-full flex items-center gap-3 p-1.5 rounded-xl hover:bg-teal-50 text-left"
                >
                  <img src={t.cover} alt="" className="w-10 h-10 rounded-lg border-2 border-black object-cover flex-shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-black truncate">{t.title}</span>
                    <span className="block text-xs text-black/60 truncate">{t.artist}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-black/50 mt-2">Liked tracks are added to your play queue.</p>
        </section>
      )}
    </aside>
  );
};

export default SessionPanel;
