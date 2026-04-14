import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Heart,
  Share2,
  X,
  Loader2,
  Clock,
  User
} from 'lucide-react';
import { Track } from '../../store/useStore';

interface MusicPlayerModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
}

const MusicPlayerModal: React.FC<MusicPlayerModalProps> = ({
  track,
  isOpen,
  onClose
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [previousVolume, setPreviousVolume] = useState(1);

  useEffect(() => {
    if (track && isOpen) {
      // Reset player state when track changes
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsBuffering(true);
      
      if (audioRef.current) {
        audioRef.current.load();
      }
    }
  }, [track, isOpen]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsBuffering(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!audioRef.current || !track) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      setVolume(previousVolume);
      if (audioRef.current) {
        audioRef.current.volume = previousVolume;
      }
      setIsMuted(false);
    } else {
      setPreviousVolume(volume);
      setVolume(0);
      if (audioRef.current) {
        audioRef.current.volume = 0;
      }
      setIsMuted(true);
    }
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
  };

  const handleShare = () => {
    if (track) {
      navigator.share?.({
        title: track.title,
        text: `Check out ${track.title} by ${track.artist}`,
        url: window.location.href,
      }).catch(console.error);
    }
  };

  if (!track) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-dark-800 rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white font-kyobo">Now Playing</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-dark-700 text-white hover:bg-dark-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Album Art */}
            <div className="relative mb-6">
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-primary-600 to-secondary-600">
                {track.cover ? (
                  <img
                    src={track.cover}
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-white text-6xl">🎵</div>
                  </div>
                )}
                
                {/* Buffering overlay */}
                {isBuffering && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <Loader2 size={32} className="text-white animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Track Info */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white font-kotra mb-2">
                {track.title}
              </h3>
              <p className="text-dark-300 font-kyobo mb-1">
                {track.artist}
              </p>
              {track.album && (
                <p className="text-dark-400 text-sm font-kyobo">
                  {track.album}
                </p>
              )}
              {track.genre && (
                <div className="mt-2">
                  <span className="px-3 py-1 bg-primary-600 text-white text-xs rounded-full">
                    {track.genre}
                  </span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-dark-400 mb-2">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${(currentTime / duration) * 100}%, var(--color-dark-600) ${(currentTime / duration) * 100}%, var(--color-dark-600) 100%)`
                }}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center space-x-4 mb-6">
              <button
                onClick={handlePlayPause}
                disabled={isBuffering}
                className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {isBuffering ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : isPlaying ? (
                  <Pause size={20} />
                ) : (
                  <Play size={20} />
                )}
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center space-x-3 mb-6">
              <button
                onClick={handleMuteToggle}
                className="p-2 text-dark-400 hover:text-white transition-colors"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="flex-1 h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={handleLike}
                className={`p-3 rounded-full transition-colors ${
                  isLiked 
                    ? 'bg-red-600 text-white' 
                    : 'bg-dark-700 text-dark-400 hover:text-white'
                }`}
              >
                <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
              </button>
              
              <button
                onClick={handleShare}
                className="p-3 rounded-full bg-dark-700 text-dark-400 hover:text-white transition-colors"
              >
                <Share2 size={20} />
              </button>
            </div>

            {/* Audio Element */}
            <audio
              ref={audioRef}
              src={track.audioUrl}
              preload="metadata"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MusicPlayerModal; 