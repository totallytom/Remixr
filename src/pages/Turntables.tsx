import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Music } from 'lucide-react';
import { useStore } from '../store/useStore';

const DEFAULT_TRACK_COVER = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';

const Turntables: React.FC = () => {
  const navigate = useNavigate();
  const { player, pauseTrack, resumeTrack } = useStore();
  const { currentTrack, isPlaying, isBuffering } = player;

  const togglePlayPause = () => {
    if (isPlaying) {
      pauseTrack();
    } else {
      resumeTrack();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white p-4 sm:p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 w-full h-full max-w-6xl">

        {/* ── Left column: Back button + Turntable wrapper ─────────────────── */}
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <button
            onClick={() => navigate(-1)}
            className="self-start w-11 h-11 rounded-full bg-black hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-sm transition-all duration-200 active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Wrapper 1 — Turntable */}
          <div className="relative flex-1 min-h-[260px] sm:min-h-0 aspect-square sm:aspect-auto rounded-2xl bg-[#1a1a1a] border-4 border-black flex items-center justify-center overflow-hidden">
            <div className="relative w-[80%] aspect-square">
              {/* Ambient glow */}
              <div
                className="absolute inset-0 rounded-full blur-3xl opacity-30 scale-110"
                style={{ background: 'radial-gradient(circle, var(--color-primary), transparent 70%)' }}
              />

              {/* Spinning vinyl */}
              <div
                className="relative w-full h-full rounded-full shadow-2xl"
                style={{
                  background:
                    'repeating-radial-gradient(circle, var(--color-primary) 0px, var(--color-primary) 14px, var(--color-secondary) 14px, var(--color-secondary) 28px)',
                  border: '4px solid #000',
                  animation: 'turntable-spin 3.2s linear infinite',
                  animationPlayState: isPlaying ? 'running' : 'paused',
                }}
              >
                {/* Groove texture */}
                <div
                  className="absolute inset-0 rounded-full opacity-40"
                  style={{
                    background:
                      'repeating-radial-gradient(circle, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0.25) 1px, transparent 1px, transparent 5px)',
                  }}
                />

                {/* Hub */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-[30%] h-[30%] rounded-full bg-gray-400 border-4 border-black flex items-center justify-center">
                    <div className="w-[28%] h-[28%] rounded-full bg-black border-2 border-white/70" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column: Play/Pause wrapper + Track info wrapper ────────── */}
        <div className="flex flex-col gap-5 sm:gap-6 w-full sm:w-80 md:w-96 flex-shrink-0">

          {/* Wrapper 2 — Play/Pause */}
          <div
            className="rounded-2xl border-4 border-black p-5 flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--color-warm) 55%, white)' }}
          >
            <button
              onClick={togglePlayPause}
              disabled={!currentTrack || isBuffering}
              className="w-16 h-16 rounded-full bg-black shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:hover:scale-100"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={26} className="text-white" fill="currentColor" />
              ) : (
                <Play size={26} className="text-white ml-1" fill="currentColor" />
              )}
            </button>
          </div>

          {/* Wrapper 3 — Track info (title box over cover-art box) */}
          <div
            className="mt-auto h-28 sm:h-32rounded-2xl border-4 border-black p-3 flex flex-col gap-3 min-h-[220px] sm:min-h-0"
            style={{ background: 'color-mix(in srgb, var(--color-primary) 45%, white)' }}
          >
            {/* Title box */}
            <div className="bg-white rounded-lg border-2 border-black px-4 py-3 flex items-center justify-center">
              {currentTrack ? (
                <div className="text-center min-w-0">
                  <p className="text-black font-bold text-sm truncate">{currentTrack.title}</p>
                  <p className="text-gray-600 text-xs truncate mt-0.5">{currentTrack.artist}</p>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No track playing</p>
              )}
            </div>

            {/* Cover art box */}
            <div className="flex-1 bg-white rounded-lg border-2 border-black overflow-hidden flex items-center justify-center">
              {currentTrack ? (
                <img
                  src={currentTrack.cover || DEFAULT_TRACK_COVER}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music size={32} className="text-gray-300" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Turntables;
