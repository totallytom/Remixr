import React, { useState, useRef, useEffect } from 'react';
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
  Minimize2
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Track } from '../../store/useStore';

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
    addToQueue,
    removeFromQueue,
    setUser,
    setUserAvatar
  } = useStore();
  
  const [showQueue, setShowQueue] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);

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
        return 'text-var(--color-warm)';
      case 'all':
        return 'text-var(--color-secondary)';
      default:
        return 'text-var(--color-text-secondary)';
    }
  };

  const getShuffleIconColor = () => {
    return player.shuffle ? 'text-var(--color-warm)' : 'text-var(--color-text-secondary)';
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
                <X size={20} className="text-white" />
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
            <div className="flex-1 flex flex-col items-center justify-center px-6">
              {/* Album Art */}
              <div className="relative mb-8">
                <div className="w-64 h-64 lg:w-80 lg:h-80 bg-gradient-to-br from-var(--color-surface) to-var(--color-background) border-4 border-white border-opacity-20 rounded-2xl overflow-hidden shadow-2xl">
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
              <div className="text-center mb-8 max-w-md">
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
              <div className="w-full max-w-md mb-8">
                <div className="flex items-center space-x-4">
                  <span className="text-white text-opacity-80 font-kyobo text-sm min-w-[3rem]">
                    {formatTime(currentTime)}
                  </span>
                  
                  <div className="flex-1 relative">
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
              <div className="flex items-center space-x-6 mb-8">
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
                  className="w-20 h-20 bg-var(--color-warm) rounded-full flex items-center justify-center hover:bg-var(--color-secondary) transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl"
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
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-var(--color-warm) rounded-full text-xs flex items-center justify-center">
                      <span className="text-xs text-white">1</span>
                    </div>
                  )}
                </button>
              </div>

              {/* Secondary Controls */}
              <div className="flex items-center space-x-4">
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
                  className={`w-10 h-10 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-all duration-300 ${showQueue ? 'text-var(--color-warm)' : 'text-white'}`}
                  title="Queue"
                >
                  <List size={18} />
                  {player.queue.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-var(--color-warm) rounded-full text-xs flex items-center justify-center">
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
                  <span className="text-var(--color-warm) text-sm font-medium">
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
      <div className="fixed z-50 lg:bottom-4 lg:right-4 bottom-20 right-4">
        <button
          onClick={onToggleVisibility}
          className="w-12 h-12 bg-white border-2 border-var(--color-warm) flex items-center justify-center hover:bg-var(--color-warm) hover:text-white transition-all duration-300 transform hover:scale-105 rounded-full shadow-lg"
          title="Show Music Player"
        >
          <ChevronUp size={20} className="text-black" />
        </button>
      </div>
    );
  }

  if (!currentTrack) {
    return (
      <div className="music-player glass-effect">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center h-16 flex-1">
            <div className="text-var(--color-text-secondary) font-kyobo text-sm">
              No track selected
            </div>
          </div>
          <button
            onClick={onToggleVisibility}
            className="w-8 h-8 bg-var(--color-surface) border-2 border-var(--color-border) flex items-center justify-center hover:border-var(--color-warm) transition-all duration-300 mr-4"
            title="Hide Music Player"
          >
            <ChevronDown size={16} className="text-var(--color-text-secondary)" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="music-player glass-effect">
      {/* Cozy Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="w-full h-full" style={{
          backgroundImage: `
            linear-gradient(45deg, var(--color-warm) 1px, transparent 1px),
            linear-gradient(-45deg, var(--color-secondary) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }} />
      </div>

      <div className="relative z-10 flex items-center space-x-1 lg:space-x-4">
        {/* Album Art - Clickable for Full Screen */}
        <div className="relative group flex-shrink-0">
          <button
            onClick={() => setShowFullScreen(true)}
            className="relative block group"
          >
            <div className="w-9 h-10 lg:w-16 lg:h-16 bg-gradient-to-br from-var(--color-surface) to-var(--color-background) border-2 border-var(--color-warm) overflow-hidden">
              <img
                src={currentTrack.cover || DEFAULT_TRACK_COVER}
                alt={currentTrack.title}
                className="w-full h-full object-cover pixelated"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            
            {/* Full Screen Icon Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
              <Maximize2 size={16} className="text-white opacity-0 group-hover:opacity-100 transition-all duration-300" />
            </div>
          </button>
          
          {/* Loading indicator */}
          {player.isBuffering && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <Loader2 size={14} className="text-white animate-spin lg:w-5 lg:h-5" />
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0 flex-shrink">
          <p className="font-kotra text-xs lg:text-sm text-var(--color-text) truncate leading-tight">
            {currentTrack.title}
          </p>
          <p className="font-kyobo text-xs text-var(--color-text-secondary) truncate">
            {currentTrack.artist}
          </p>
          <p className="font-kyobo text-xs text-var(--color-text-secondary) opacity-80 truncate hidden lg:block">
            {currentTrack.album}
          </p>
        </div>

        {/* Enhanced Controls */}
        <div className="flex items-center space-x-0.5 lg:space-x-2 flex-shrink-0">
          {/* Shuffle Button */}
          <button
            onClick={toggleShuffle}
            className={`w-5 h-5 lg:w-8 lg:h-8 bg-var(--color-surface) border-2 border-var(--color-border) flex items-center justify-center hover:border-var(--color-warm) transition-all duration-300 ${getShuffleIconColor()}`}
            title="Shuffle"
          >
            <Shuffle size={10} className="lg:w-3.5 lg:h-3.5" />
          </button>

          {/* Rewind Button - Hidden on mobile */}
          <button
            onClick={handleRewind}
            className="w-8 h-8 lg:w-10 lg:h-10 bg-var(--color-surface) border-2 border-var(--color-border) flex items-center justify-center hover:border-var(--color-warm) hover:bg-var(--color-warm) hover:text-var(--color-background) transition-all duration-300 group hidden lg:flex"
            title="Rewind"
          >
            <RotateCcw size={16} className="lg:w-[18px] lg:h-[18px]" />
          </button>

          {/* Previous Button */}
          <button
            onClick={onPrevious}
            className="w-6 h-6 lg:w-10 lg:h-10 bg-var(--color-surface) border-2 border-var(--color-border) flex items-center justify-center hover:border-var(--color-warm) hover:bg-var(--color-warm) hover:text-var(--color-background) transition-all duration-300 group"
            title="Previous"
          >
            <SkipBack size={12} className="lg:w-[18px] lg:h-[18px]" />
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={onPlayPause}
            disabled={player.isBuffering}
            className="w-8 h-8 lg:w-12 lg:h-12 bg-var(--color-warm) border-2 border-white flex items-center justify-center hover:bg-var(--color-secondary) transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isPlaying ? "Pause" : "Play"}
          >
            {player.isBuffering ? (
              <Loader2 size={14} className="text-white animate-spin lg:w-5 lg:h-5" />
            ) : isPlaying ? (
              <Pause size={16} className="text-black lg:w-6 lg:h-6" />
            ) : (
              <Play size={16} className="text-black lg:w-6 lg:h-6" />
            )}
          </button>

          {/* Next Button */}
          <button
            onClick={onNext}
            className="w-6 h-6 lg:w-10 lg:h-10 bg-var(--color-surface) border-2 border-var(--color-border) flex items-center justify-center hover:border-var(--color-warm) hover:bg-var(--color-warm) hover:text-var(--color-background) transition-all duration-300 group"
            title="Next"
          >
            <SkipForward size={12} className="lg:w-[18px] lg:h-[18px]" />
          </button>

          {/* Repeat Button */}
          <button
            onClick={toggleRepeat}
            className={`w-5 h-5 lg:w-8 lg:h-8 bg-var(--color-surface) border-2 border-var(--color-border) flex items-center justify-center hover:border-var(--color-warm) transition-all duration-300 ${getRepeatIconColor()}`}
            title={`Repeat: ${player.repeatMode}`}
          >
            <Repeat size={10} className="lg:w-3.5 lg:h-3.5" />
            {player.repeatMode === 'one' && (
              <div className="absolute -bottom-1 -right-1 w-1 h-1 lg:w-2 lg:h-2 bg-var(--color-warm) rounded-full text-xs">1</div>
            )}
          </button>
        </div>

        {/* Progress Bar - Hidden on mobile, visible on desktop */}
        <div className="flex-1 max-w-md hidden lg:block">
          <div className="flex items-center space-x-2">
            <span className="font-kyobo text-xs text-var(--color-text-secondary) min-w-[2rem]">
              {formatTime(currentTime)}
            </span>
            
            <div className="flex-1 relative">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-var(--color-border) appearance-none cursor-pointer relative"
                style={{
                  background: `linear-gradient(to right, var(--color-warm) 0%, var(--color-warm) ${(currentTime / (duration || 1)) * 100}%, var(--color-border) ${(currentTime / (duration || 1)) * 100}%, var(--color-border) 100%)`
                }}
              />
              <div className="absolute top-0 left-0 h-2 bg-var(--color-warm) transition-all duration-100" 
                   style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
            </div>
            
            <span className="font-kyobo text-xs text-var(--color-text-secondary) min-w-[2rem]">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Action Buttons - Visible on mobile but compact */}
        <div className="flex items-center space-x-1 lg:space-x-2">
          {/* Bookmark Button */}
          <button
            onClick={handleBookmark}
            className={`w-6 h-6 lg:w-8 lg:h-8 bg-var(--color-surface) border-2 border-var(--color-border) flex items-center justify-center hover:border-var(--color-warm) transition-all duration-300 ${isBookmarked ? 'text-blue-400' : 'text-var(--color-text-secondary)'}`}
            title="Bookmark"
          >
            <Bookmark size={12} className="lg:w-3.5 lg:h-3.5" fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>

          {/* Queue Button */}
          <button
            onClick={() => setShowQueue(!showQueue)}
            className={`w-6 h-6 lg:w-8 lg:h-8 bg-var(--color-surface) border-2 border-var(--color-border) flex items-center justify-center hover:border-var(--color-warm) transition-all duration-300 ${showQueue ? 'text-var(--color-warm)' : 'text-var(--color-text-secondary)'}`}
            title="Queue"
          >
            <List size={12} className="lg:w-3.5 lg:h-3.5" />
            {player.queue.length > 0 && (
              <div className="absolute -top-1 -right-1 w-2 h-2 lg:w-3 lg:h-3 bg-var(--color-warm) rounded-full text-xs flex items-center justify-center">
                <span className="text-xs text-white">{player.queue.length}</span>
              </div>
            )}
          </button>

          {/* Volume Control */}
          <div className="relative">
            <button
              onClick={() => setShowVolume(!showVolume)}
              className="w-6 h-6 lg:w-8 lg:h-8 bg-var(--color-surface) border-2 border-var(--color-border) flex items-center justify-center hover:border-var(--color-warm) transition-all duration-300"
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
              <div className="absolute bottom-full right-0 mb-2 p-2 lg:p-3 bg-var(--color-surface) border-2 border-var(--color-warm) glass-effect">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(player.volume * 100)}
                  onChange={handleVolumeChange}
                  className="w-16 lg:w-20 h-2 bg-var(--color-border) appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to top, var(--color-warm) 0%, var(--color-warm) ${player.volume * 100}%, var(--color-border) ${player.volume * 100}%, var(--color-border) 100%)`
                  }}
                />
              </div>
            )}
          </div>

          {/* Hide Button */}
          <button
            onClick={onToggleVisibility}
            className="w-6 h-6 lg:w-8 lg:h-8 bg-var(--color-surface) border-2 border-var(--color-border) flex items-center justify-center hover:border-var(--color-warm) transition-all duration-300"
            title="Hide Music Player"
          >
            <ChevronDown size={12} className="lg:w-3.5 lg:h-3.5 text-var(--color-text-secondary)" />
          </button>
        </div>
      </div>

      {/* Cozy Bottom Border */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-var(--color-warm) via-var(--color-secondary) to-var(--color-warm)" />
      
      {/* Gentle Particle Effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-var(--color-glow) opacity-30 animate-ping" style={{ animationDelay: '0s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-1 h-1 bg-var(--color-secondary) opacity-25 animate-ping" style={{ animationDelay: '2s' }} />
      </div>

      {/* Enhanced Queue Panel */}
      {showQueue && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="absolute bottom-20 left-0 right-0 p-4 max-h-64 overflow-y-auto"
          style={{
            background: 'var(--color-surface)',
            border: '2px solid var(--color-neon)',
            boxShadow: '0 0 20px var(--color-neon)'
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 
              className="text-sm font-medium"
              style={{ 
                color: 'var(--color-text)',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: '10px'
              }}
            >
              Queue ({player.queue.length})
            </h3>
            {player.shuffle && (
              <span 
                className="text-xs"
                style={{ 
                  color: 'var(--color-warm)',
                  fontFamily: 'Press Start 2P, monospace',
                  fontSize: '8px'
                }}
              >
                SHUFFLED
              </span>
            )}
          </div>
          
          {player.queue.length === 0 ? (
            <p 
              className="text-sm"
              style={{ 
                color: 'var(--color-text-secondary)',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: '8px'
              }}
            >
              No tracks in queue
            </p>
          ) : (
            <div className="space-y-2">
              {player.queue.map((track, index) => (
                <div
                  key={track.id}
                  className="flex items-center space-x-3 p-2 cursor-pointer group"
                  style={{
                    background: 'var(--color-background)',
                    border: '1px solid var(--color-border)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-neon)';
                    e.currentTarget.style.boxShadow = '0 0 10px var(--color-neon)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={() => playTrack(track)}
                >
                  <span 
                    className="text-xs w-6 text-center"
                    style={{ 
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'Press Start 2P, monospace',
                      fontSize: '8px'
                    }}
                  >
                    {index + 1}
                  </span>
                  <img
                    src={track.cover}
                    alt={track.title}
                    className="w-8 h-8 object-cover"
                    style={{ 
                      imageRendering: 'pixelated',
                      border: '1px solid var(--color-border)'
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p 
                      className="text-sm font-medium truncate font-kotra"
                      style={{ 
                        color: 'var(--color-text)',
                        fontFamily: 'Press Start 2P, monospace',
                        fontSize: '8px'
                      }}
                    >
                      {track.title}
                    </p>
                    <p 
                      className="text-xs truncate"
                      style={{ 
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'Press Start 2P, monospace',
                        fontSize: '6px'
                      }}
                    >
                      {track.artist}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFromQueue(track.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500 hover:text-white rounded"
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
  );
};

export default MusicPlayer; 