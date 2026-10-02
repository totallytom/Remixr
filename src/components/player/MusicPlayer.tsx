import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Bookmark,
  Share2,
  List,
  ChevronDown,
  ChevronUp,
  Repeat,
  Shuffle,
  Loader2,
  RotateCcw,
  X,
  Maximize2,
  Minimize2,
  Disc3
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Track } from '../../store/useStore';
import { useHype } from '../../services/hypeService';
import { HypeStrip, HypeButton } from './Hype';

const DEFAULT_TRACK_COVER = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';

interface MusicPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  currentTime: number;
  duration: number;
  visible: boolean;
  onToggleVisibility: () => void;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({
  currentTrack,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  currentTime,
  duration,
  visible,
  onToggleVisibility,
}) => {
  const {
    player,
    setVolume,
    toggleRepeat,
    toggleShuffle,
    playTrack,
    pauseTrack,
    addToQueue,
    removeFromQueue,
    setUser,
    setUserAvatar,
    user,
  } = useStore();
  const navigate = useNavigate();

  const [showQueue, setShowQueue] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [showPreviewEnded, setShowPreviewEnded] = useState(false);

  // Hype moments: heat map along the progress bar + 🔥 button.
  const { map: hypeMap, hype, lastResult: hypeResult } = useHype(currentTrack?.id, duration);
  const canHype = Boolean(user) && Boolean(currentTrack) && !currentTrack?.previewOnly;
  const hypeNow = () => { if (canHype) hype(currentTime); };

  // Clear the preview-ended banner whenever a non-preview track starts.
  useEffect(() => {
    if (!currentTrack?.previewOnly) setShowPreviewEnded(false);
  }, [currentTrack?.id, currentTrack?.previewOnly]);

  // Stop at 30 s for preview-only tracks.
  useEffect(() => {
    if (currentTrack?.previewOnly && currentTime >= 30 && isPlaying) {
      pauseTrack();
      setShowPreviewEnded(true);
    }
  }, [currentTime, currentTrack?.previewOnly, isPlaying, pauseTrack]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    onSeek(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume / 100);
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
  };

  const handleAddToQueue = (track: Track) => {
    addToQueue(track);
  };

  const handleRemoveFromQueue = (trackId: string) => {
    removeFromQueue(trackId);
  };

  const handleRewind = () => {
    if (player.audioElement) {
      player.audioElement.currentTime = 0;
    }
  };

  const getRepeatIconColor = () => {
    switch (player.repeatMode) {
      case 'one':
        return 'text-[var(--color-warm)]';
      case 'all':
        return 'text-[var(--color-secondary)]';
      default:
        return 'text-[var(--color-text-secondary)]';
    }
  };

  const getShuffleIconColor = () => {
    return player.shuffle ? 'text-[var(--color-warm)]' : 'text-[var(--color-text-secondary)]';
  };

  // Full Screen YouTube Music-like Player
  if (showFullScreen && currentTrack) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black bg-opacity-95 backdrop-blur-md"
        >
          {/* Background Image with Overlay */}
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${currentTrack.cover || DEFAULT_TRACK_COVER})`,
              filter: 'blur(20px) brightness(0.3)'
            }}
          />
          
          {/* Content Container */}
          <div className="relative z-10 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6">
              <button
                onClick={() => setShowFullScreen(false)}
                className="w-10 h-10 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-all duration-300"
              >
                <X size={20} className="text-b" />
              </button>
              
              <div className="text-center">
                <h2 className="text-white text-sm font-medium opacity-80">Now Playing</h2>
                <p className="text-white text-xs opacity-60">From {currentTrack.album}</p>
              </div>
              
              <button
                onClick={() => setShowFullScreen(false)}
                className="w-10 h-10 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-all duration-300"
              >
                <Minimize2 size={20} className="text-white" />
              </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 overflow-y-auto py-4">
              {/* Album Art */}
              <div className="relative mb-4 flex-shrink-0">
                <div
                  className="bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-background)] border-4 border-white border-opacity-20 rounded-2xl overflow-hidden shadow-2xl"
                  style={{ width: 'clamp(9rem, 32vh, 20rem)', height: 'clamp(9rem, 32vh, 20rem)' }}
                >
                  <img
                    src={currentTrack.cover || DEFAULT_TRACK_COVER}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Loading indicator */}
                {player.isBuffering && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-2xl">
                    <Loader2 size={40} className="text-white animate-spin" />
                  </div>
                )}
              </div>

              {/* Track Info */}
              <div className="text-center mb-4 max-w-md flex-shrink-0">
                <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2 font-kotra">
                  {currentTrack.title}
                </h1>
                <p className="text-lg text-white text-opacity-80 mb-1 font-kyobo">
                  {currentTrack.artist}
                </p>
                <p className="text-sm text-white text-opacity-60 font-kyobo">
                  {currentTrack.album}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md mb-4 flex-shrink-0">
                <div className="flex items-center space-x-4">
                  <span className="text-white text-opacity-80 font-kyobo text-sm min-w-[3rem]">
                    {formatTime(currentTime)}
                  </span>

                  <div className="flex-1 relative">
                    <HypeStrip map={hypeMap} tone="dark" height={18} className="absolute left-0 right-0 bottom-full mb-1" />
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-2 bg-white bg-opacity-20 appearance-none cursor-pointer rounded-full"
                      style={{
                        background: `linear-gradient(to right, var(--color-warm) 0%, var(--color-warm) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) 100%)`
                      }}
                    />
                  </div>

                  <span className="text-white text-opacity-80 font-kyobo text-sm min-w-[3rem]">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* Main Controls */}
              <div className="flex items-center space-x-6 mb-4 flex-shrink-0">
                {/* Shuffle Button */}
                <button
                  onClick={toggleShuffle}
                  className={`w-12 h-12 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-all duration-300 ${getShuffleIconColor()}`}
                  title="Shuffle"
                >
                  <Shuffle size={20} className="text-white" />
                </button>

                {/* Previous Button */}
                <button
                  onClick={onPrevious}
                  className="w-14 h-14 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-all duration-300"
                  title="Previous"
                >
                  <SkipBack size={24} className="text-white" />
                </button>

                {/* Play/Pause Button */}
                <button
                  onClick={onPlayPause}
                  disabled={player.isBuffering}
                  className="w-20 h-20 bg-[var(--color-warm)] rounded-full flex items-center justify-center hover:bg-[var(--color-secondary)] transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {player.isBuffering ? (
                    <Loader2 size={32} className="text-white animate-spin" />
                  ) : isPlaying ? (
                    <Pause size={32} className="text-white" />
                  ) : (
                    <Play size={32} className="text-white ml-1" />
                  )}
                </button>

                {/* Next Button */}
                <button
                  onClick={onNext}
                  className="w-14 h-14 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-all duration-300"
                  title="Next"
                >
                  <SkipForward size={24} className="text-white" />
                </button>

                {/* Repeat Button */}
                <button
                  onClick={toggleRepeat}
                  className={`w-12 h-12 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-all duration-300 ${getRepeatIconColor()}`}
                  title={`Repeat: ${player.repeatMode}`}
                >
                  <Repeat size={20} className="text-white" />
                  {player.repeatMode === 'one' && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[var(--color-warm)] rounded-full text-xs flex items-center justify-center">
                      <span className="text-xs text-white">1</span>
                    </div>
                  )}
                </button>
              </div>

              {/* Secondary Controls */}
              <div className="flex items-center space-x-4 flex-shrink-0">
                {/* Hype this moment */}
                <HypeButton
                  onHype={hypeNow}
                  lastResult={hypeResult}
                  disabled={!canHype}
                  disabledReason={user ? 'Hype isn’t available for previews' : 'Sign in to hype moments'}
                  count={hypeMap.total}
                  className="h-10 px-3 bg-white bg-opacity-20 backdrop-blur-sm rounded-full text-white hover:bg-opacity-30"
                />
                {/* Bookmark Button */}
                <button
                  onClick={handleBookmark}
                  className={`w-10 h-10 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-all duration-300 ${isBookmarked ? 'text-blue-400' : 'text-white'}`}
                  title="Bookmark"
                >
                  <Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
                </button>

                {/* Queue Button */}
                <button
                  onClick={() => setShowQueue(!showQueue)}
                  className={`w-10 h-10 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-all duration-300 ${showQueue ? 'text-[var(--color-warm)]' : 'text-white'}`}
                  title="Queue"
                >
                  <List size={18} />
                  {player.queue.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--color-warm)] rounded-full text-xs flex items-center justify-center">
                      <span className="text-xs text-white">{player.queue.length}</span>
                    </div>
                  )}
                </button>

                {/* Volume Control */}
                <div className="relative">
                  <button
                    onClick={() => setShowVolume(!showVolume)}
                    className="w-10 h-10 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-all duration-300"
                  >
                    <Volume2 size={18} className="text-white" />
                  </button>
                  
                  {showVolume && (
                    <div className="absolute bottom-full right-0 mb-3 p-3 bg-white bg-opacity-20 backdrop-blur-sm rounded-lg border border-white border-opacity-20">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(player.volume * 100)}
                        onChange={handleVolumeChange}
                        className="w-24 h-2 bg-white bg-opacity-20 appearance-none cursor-pointer rounded-full"
                        style={{
                          background: `linear-gradient(to top, var(--color-warm) 0%, var(--color-warm) ${player.volume * 100}%, rgba(255,255,255,0.2) ${player.volume * 100}%, rgba(255,255,255,0.2) 100%)`
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Rewind Button */}
                <button
                  onClick={handleRewind}
                  className="w-10 h-10 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-all duration-300"
                  title="Rewind"
                >
                  <RotateCcw size={18} className="text-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Queue Panel */}
          {showQueue && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-0 left-0 right-0 p-6 max-h-80 overflow-y-auto bg-black bg-opacity-80 backdrop-blur-md border-t border-white border-opacity-20"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium text-lg">
                  Queue ({player.queue.length})
                </h3>
                {player.shuffle && (
                  <span className="text-[var(--color-warm)] text-sm font-medium">
                    SHUFFLED
                  </span>
                )}
              </div>
              
              {player.queue.length === 0 ? (
                <p className="text-white text-opacity-60 text-center py-8">
                  No tracks in queue
                </p>
              ) : (
                <div className="space-y-3">
                  {player.queue.map((track, index) => (
                    <div
                      key={track.id}
                      className="flex items-center space-x-4 p-3 cursor-pointer group rounded-lg hover:bg-white hover:bg-opacity-10 transition-all duration-300"
                      onClick={() => playTrack(track)}
                    >
                      <span className="text-white text-opacity-60 text-sm w-8 text-center">
                        {index + 1}
                      </span>
                      <img
                        src={track.cover}
                        alt={track.title}
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-white font-medium truncate">
                          {track.title}
                        </p>
                        <p className="text-white text-opacity-60 text-sm truncate">
                          {track.artist}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromQueue(track.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500 hover:text-white rounded-full"
                        title="Remove from queue"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  if (!visible) {
    return (
      <div className="fixed z-50 lg:bottom-4 lg:right-4 bottom-16 right-4">
        <button
          onClick={onToggleVisibility}
          className="w-12 h-12 bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-all duration-200 hover:scale-105 active:scale-95 rounded-full shadow-lg"
          title="Show Music Player"
        >
          <ChevronUp size={20} className="text-black" />
        </button>
      </div>
    );
  }

  if (!currentTrack) {
    return (
      <div className="bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center h-16 flex-1">
            <div className="text-gray-500 font-kyobo text-sm">
              No track selected
            </div>
          </div>
          <button
            onClick={onToggleVisibility}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all duration-200 mr-4"
            title="Hide Music Player"
          >
            <ChevronDown size={16} className="text-gray-500" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    {/* ── Mobile mini player ── sits directly above the 56px bottom tab bar */}
    <div
      className="lg:hidden fixed left-0 right-0 z-40 h-16 bg-white border-t border-gray-200"
      style={{ bottom: '56px', boxShadow: '0 -2px 12px rgba(0,0,0,0.08)' }}
    >
      {/* Thin seekable progress line at the very top edge */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gray-100">
        <div
          className="h-full bg-[var(--color-electric-blue,#0ea5e9)] transition-all duration-100"
          style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
        />
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ margin: 0, padding: 0 }}
          aria-label="Seek"
        />
      </div>

      <div className="flex items-center h-full px-3 gap-2">
        {/* Album art — taps to open fullscreen */}
        <button
          onClick={() => setShowFullScreen(true)}
          className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden ring-1 ring-black/10 active:scale-95 transition-transform"
        >
          <img
            src={currentTrack.cover || DEFAULT_TRACK_COVER}
            alt={currentTrack.title}
            className="w-full h-full object-cover"
          />
        </button>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate text-black leading-tight">{currentTrack.title}</p>
          {showPreviewEnded ? (
            <p className="text-xs font-medium text-amber-500 truncate">Preview ended · buy to unlock</p>
          ) : (
            <p className="text-xs text-gray-500 truncate">{currentTrack.artist}</p>
          )}
        </div>

        {/* Previous */}
        <button
          onClick={onPrevious}
          className="w-11 h-11 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors"
          aria-label="Previous"
        >
          <SkipBack size={20} className="text-black" />
        </button>

        {/* Play / Pause */}
        <button
          onClick={onPlayPause}
          disabled={player.isBuffering}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-primary-600 shadow-md active:scale-95 transition-all disabled:opacity-50"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {player.isBuffering ? (
            <Loader2 size={20} className="animate-spin text-black" />
          ) : isPlaying ? (
            <Pause size={20} className="text-black" />
          ) : (
            <Play size={20} className="text-black ml-0.5" />
          )}
        </button>

        {/* Next */}
        <button
          onClick={onNext}
          className="w-11 h-11 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors"
          aria-label="Next"
        >
          <SkipForward size={20} className="text-black" />
        </button>

        {/* Turntables — open the dedicated spinning-record view (disabled until the page is finished)
        <button
          onClick={() => navigate('/turntables')}
          className="w-9 h-9 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors flex-shrink-0"
          aria-label="Open Turntables"
        >
          <Disc3 size={19} className="text-black" />
        </button>
        */}

        {/* Dismiss / hide player */}
        <button
          onClick={onToggleVisibility}
          className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors flex-shrink-0"
          aria-label="Hide player"
        >
          <ChevronDown size={18} className="text-gray-400" />
        </button>
      </div>
    </div>

    {/* ── Desktop player bar ── hidden on mobile */}
    <div className="hidden lg:block">
    <div className="relative bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] px-4 py-3">

      <div className="relative z-10 flex items-center space-x-1 lg:space-x-4">
        {/* Album Art - Clickable for Full Screen */}
        <div className="relative group flex-shrink-0">
          <button
            onClick={() => setShowFullScreen(true)}
            className="relative block group"
          >
            <div className="w-9 h-10 lg:w-16 lg:h-16 rounded-lg ring-1 ring-black/10 overflow-hidden">
              <img
                src={currentTrack.cover || DEFAULT_TRACK_COVER}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Full Screen Icon Overlay */}
            <div className="absolute inset-0 rounded-lg bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
              <Maximize2 size={16} className="text-white opacity-0 group-hover:opacity-100 transition-all duration-300" />
            </div>
          </button>

          {/* Loading indicator */}
          {player.isBuffering && (
            <div className="absolute inset-0 rounded-lg bg-black bg-opacity-50 flex items-center justify-center">
              <Loader2 size={14} className="text-white animate-spin lg:w-5 lg:h-5" />
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0 flex-shrink">
          <p className="font-kotra text-xs lg:text-sm text-black truncate leading-tight">
            {currentTrack.title}
          </p>
          {showPreviewEnded ? (
            <p className="font-kyobo text-xs font-semibold text-amber-500 truncate">
              Preview ended · buy to unlock
            </p>
          ) : (
            <p className="font-kyobo text-xs text-gray-500 truncate">
              {currentTrack.artist}
            </p>
          )}
          <p className="font-kyobo text-xs text-gray-400 truncate hidden lg:block">
            {currentTrack.album}
          </p>
        </div>

        {/* Enhanced Controls */}
        <div className="flex items-center space-x-0.5 lg:space-x-2 flex-shrink-0">
          {/* Shuffle Button */}
          <button
            onClick={toggleShuffle}
            className={`w-7 h-7 lg:w-9 lg:h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all duration-200 hover:scale-105 active:scale-95 ${getShuffleIconColor()}`}
            title="Shuffle"
          >
            <Shuffle size={13} className="lg:w-4 lg:h-4" />
          </button>

          {/* Rewind Button - Hidden on mobile */}
          <button
            onClick={handleRewind}
            className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-gray-100 items-center justify-center text-gray-500 hover:text-black hover:bg-gray-200 transition-all duration-200 hover:scale-105 active:scale-95 hidden lg:flex"
            title="Rewind"
          >
            <RotateCcw size={17} className="lg:w-[18px] lg:h-[18px]" />
          </button>

          {/* Previous Button */}
          <button
            onClick={onPrevious}
            className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-200 transition-all duration-200 hover:scale-105 active:scale-95"
            title="Previous"
          >
            <SkipBack size={14} className="lg:w-[18px] lg:h-[18px]" />
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={onPlayPause}
            disabled={player.isBuffering}
            className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-primary-600 shadow-md flex items-center justify-center hover:bg-primary-700 hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            title={isPlaying ? "Pause" : "Play"}
          >
            {player.isBuffering ? (
              <Loader2 size={16} className="text-black animate-spin lg:w-5 lg:h-5" />
            ) : isPlaying ? (
              <Pause size={18} className="text-black lg:w-6 lg:h-6" />
            ) : (
              <Play size={18} className="text-black lg:w-6 lg:h-6" />
            )}
          </button>

          {/* Next Button */}
          <button
            onClick={onNext}
            className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-200 transition-all duration-200 hover:scale-105 active:scale-95"
            title="Next"
          >
            <SkipForward size={14} className="lg:w-[18px] lg:h-[18px]" />
          </button>

          {/* Repeat Button */}
          <button
            onClick={toggleRepeat}
            className={`relative w-7 h-7 lg:w-9 lg:h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all duration-200 hover:scale-105 active:scale-95 ${getRepeatIconColor()}`}
            title={`Repeat: ${player.repeatMode}`}
          >
            <Repeat size={13} className="lg:w-4 lg:h-4" />
            {player.repeatMode === 'one' && (
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary-600 rounded-full text-black text-[8px] leading-3 font-bold">1</div>
            )}
          </button>
        </div>

        {/* Progress Bar - Hidden on mobile, visible on desktop */}
        <div className="flex-1 max-w-md hidden lg:block">
          <div className="flex items-center space-x-2">
            <span className="font-kyobo text-xs text-gray-500 min-w-[2rem]">
              {formatTime(currentTime)}
            </span>

            <div className="flex-1 relative">
              <HypeStrip map={hypeMap} height={10} className="absolute left-0 right-0 bottom-full mb-0.5" />
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer relative"
                style={{
                  background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${(currentTime / (duration || 1)) * 100}%, #e5e7eb ${(currentTime / (duration || 1)) * 100}%, #e5e7eb 100%)`
                }}
              />
            </div>

            <span className="font-kyobo text-xs text-gray-500 min-w-[2rem]">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Action Buttons - Visible on mobile but compact */}
        <div className="flex items-center space-x-1 lg:space-x-2">
          <span className="hidden lg:inline-flex">
            <HypeButton
              onHype={hypeNow}
              lastResult={hypeResult}
              disabled={!canHype}
              disabledReason={user ? 'Hype isn’t available for previews' : 'Sign in to hype moments'}
              className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-gray-100 hover:bg-orange-100"
              size={16}
            />
          </span>
          {/* Bookmark Button */}
          <button
            onClick={handleBookmark}
            className={`w-7 h-7 lg:w-9 lg:h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all duration-200 hover:scale-105 active:scale-95 ${isBookmarked ? 'text-blue-500' : 'text-gray-500 hover:text-black'}`}
            title="Bookmark"
          >
            <Bookmark size={13} className="lg:w-4 lg:h-4" fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>

          {/* Queue Button */}
          <button
            onClick={() => setShowQueue(!showQueue)}
            className={`relative w-7 h-7 lg:w-9 lg:h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all duration-200 hover:scale-105 active:scale-95 ${showQueue ? 'text-primary-600' : 'text-gray-500 hover:text-black'}`}
            title="Queue"
          >
            <List size={13} className="lg:w-4 lg:h-4" />
            {player.queue.length > 0 && (
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary-600 rounded-full text-black text-[8px] leading-[14px] font-bold">
                {player.queue.length}
              </div>
            )}
          </button>

          {/* Volume Control */}
          <div className="relative">
            <button
              onClick={() => setShowVolume(!showVolume)}
              className="w-7 h-7 lg:w-9 lg:h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-200 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <div className="w-3 h-3 lg:w-4 lg:h-4 relative">
                <div className="absolute bottom-0 left-0 w-0.5 h-2 lg:w-1 lg:h-3 bg-current" />
                <div className="absolute bottom-0 left-1 w-0.5 h-1.5 lg:w-1 lg:h-2 bg-current" />
                <div className="absolute bottom-0 left-2 w-0.5 h-1 lg:w-1 lg:h-1 bg-current" />
                {player.volume > 0.5 && <div className="absolute bottom-0 left-3 w-0.5 h-2.5 lg:w-1 lg:h-4 bg-current" />}
                {player.volume > 0.75 && <div className="absolute bottom-0 left-4 w-0.5 h-3 lg:w-1 lg:h-5 bg-current" />}
              </div>
            </button>

            {showVolume && (
              <div className="absolute bottom-full right-0 mb-2 p-3 bg-white border border-gray-200 rounded-xl shadow-lg">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(player.volume * 100)}
                  onChange={handleVolumeChange}
                  className="w-16 lg:w-20 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to top, var(--color-primary) 0%, var(--color-primary) ${player.volume * 100}%, #e5e7eb ${player.volume * 100}%, #e5e7eb 100%)`
                  }}
                />
              </div>
            )}
          </div>

          {/* Turntables — open the dedicated spinning-record view (disabled until the page is finished)
          <button
            onClick={() => navigate('/turntables')}
            className="w-7 h-7 lg:w-9 lg:h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-200 transition-all duration-200 hover:scale-105 active:scale-95"
            title="Open Turntables"
          >
            <Disc3 size={13} className="lg:w-4 lg:h-4" />
          </button>
          */}

          {/* Hide Button */}
          <button
            onClick={onToggleVisibility}
            className="w-7 h-7 lg:w-9 lg:h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all duration-200 hover:scale-105 active:scale-95"
            title="Hide Music Player"
          >
            <ChevronDown size={13} className="lg:w-4 lg:h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Queue Panel */}
      {showQueue && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="absolute bottom-20 left-0 right-0 p-4 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-t-xl shadow-2xl"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-black">
              Queue ({player.queue.length})
            </h3>
            {player.shuffle && (
              <span className="text-xs font-medium text-primary-600">
                SHUFFLED
              </span>
            )}
          </div>

          {player.queue.length === 0 ? (
            <p className="text-sm text-gray-500">
              No tracks in queue
            </p>
          ) : (
            <div className="space-y-2">
              {player.queue.map((track, index) => (
                <div
                  key={track.id}
                  className="flex items-center space-x-3 p-2 rounded-xl cursor-pointer group bg-gray-50 border border-gray-100 hover:border-primary-400 hover:bg-gray-100 transition-colors"
                  onClick={() => playTrack(track)}
                >
                  <span className="text-xs w-6 text-center text-gray-400">
                    {index + 1}
                  </span>
                  <img
                    src={track.cover}
                    alt={track.title}
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-black font-kotra">
                      {track.title}
                    </p>
                    <p className="text-xs truncate text-gray-500">
                      {track.artist}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFromQueue(track.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-red-500 hover:text-white text-gray-400"
                    title="Remove from queue"
                  >
                    <span className="text-xs">×</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
    </div>{/* end hidden lg:block */}
    </>
  );
};

export default MusicPlayer; 