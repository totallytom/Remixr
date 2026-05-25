import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, ShoppingCart, Download, Music } from 'lucide-react';
import { StoreListing, LicenseType, StorefrontService } from '../../services/storefrontService';

interface StoreTrackCardProps {
  listing: StoreListing;
  isPurchased: boolean;
  isPlaying: boolean;
  onPlay: (listing: StoreListing) => void;
  onBuy: (listing: StoreListing) => void;
  onDownloadError?: (msg: string) => void;
}

const LICENSE_BADGE: Record<LicenseType, { label: string; className: string }> = {
  personal:   { label: 'Personal',   className: 'bg-blue-500/20 text-blue-300' },
  commercial: { label: 'Commercial', className: 'bg-purple-500/20 text-purple-300' },
  exclusive:  { label: 'Exclusive',  className: 'bg-yellow-500/20 text-yellow-300' },
};

const StoreTrackCard: React.FC<StoreTrackCardProps> = ({
  listing,
  isPurchased,
  isPlaying,
  onPlay,
  onBuy,
  onDownloadError,
}) => {
  const badge = LICENSE_BADGE[listing.licenseType];
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { downloadUrl, filename } = await StorefrontService.getDownloadUrl(listing.id);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      onDownloadError?.(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-800/60 rounded-xl overflow-hidden border border-white/5 hover:border-white/10 transition-colors group"
    >
      {/* Cover */}
      <div className="relative aspect-square bg-dark-700">
        {listing.cover ? (
          <img
            src={listing.cover}
            alt={listing.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-12 h-12 text-white/20" />
          </div>
        )}

        {/* Play overlay */}
        <button
          onClick={() => onPlay(listing)}
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
        >
          {isPlaying ? (
            <Pause className="w-10 h-10 text-white fill-white" />
          ) : (
            <Play className="w-10 h-10 text-white fill-white" />
          )}
        </button>

        {/* License badge */}
        <span className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
          {badge.label}
        </span>

        {/* Playing dot */}
        {isPlaying && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div>
          <p className="text-sm font-semibold text-white truncate">{listing.title}</p>
          <p className="text-xs text-white/50 truncate">
            {listing.sellerArtistName || listing.artist}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-base font-bold text-white">${listing.price.toFixed(2)}</p>
            {listing.salesCount > 0 && (
              <p className="text-[10px] text-white/30">{listing.salesCount} sold</p>
            )}
          </div>

          {isPurchased ? (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              title="Download your purchase"
            >
              {isDownloading ? (
                <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              {isDownloading ? '…' : 'Download'}
            </button>
          ) : (
            <button
              onClick={() => onBuy(listing)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-400 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <ShoppingCart className="w-3 h-3" />
              Buy
            </button>
          )}
        </div>

        {listing.genre && (
          <p className="text-[10px] text-white/30 uppercase tracking-wide">{listing.genre}</p>
        )}
      </div>
    </motion.div>
  );
};

export default StoreTrackCard;
