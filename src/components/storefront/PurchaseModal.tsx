import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Music, Shield, Lock, ExternalLink } from 'lucide-react';
import { StoreListing, StorefrontService } from '../../services/storefrontService';

const LICENSE_DESCRIPTIONS: Record<string, string> = {
  personal:   'For personal, non-commercial use only.',
  commercial: 'Use in commercial projects, content, and monetized platforms.',
  exclusive:  'Full exclusive ownership — seller removes the listing after purchase.',
};

interface PurchaseModalProps {
  listing: StoreListing | null;
  isOpen: boolean;
  onClose: () => void;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({ listing, isOpen, onClose }) => {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!listing) return null;

  const handlePay = async () => {
    setIsRedirecting(true);
    setError(null);
    try {
      const { url } = await StorefrontService.initiateStripeCheckout(listing.id);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
      setIsRedirecting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-sm bg-dark-800 rounded-2xl border border-white/10 shadow-2xl pointer-events-auto">
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h2 className="text-base font-semibold text-black">Complete Purchase</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-black" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Track info */}
                <div className="flex gap-3 items-center">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0">
                    {listing.cover ? (
                      <img src={listing.cover} alt={listing.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-6 h-6 text-black" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black truncate">{listing.title}</p>
                    <p className="text-xs text-black truncate">
                      {listing.sellerArtistName || listing.artist}
                    </p>
                  </div>
                </div>

                {/* License */}
                <div className="p-3 bg-white/5 rounded-lg space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-black">
                    <Shield className="w-3.5 h-3.5 text-primary-400" />
                    {listing.licenseType.charAt(0).toUpperCase() + listing.licenseType.slice(1)} License
                  </div>
                  <p className="text-xs text-black">{LICENSE_DESCRIPTIONS[listing.licenseType]}</p>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-black">Total</span>
                  <span className="text-xl font-bold text-black">${listing.price.toFixed(2)}</span>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300">{error}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isRedirecting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-black hover:text-white bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePay}
                    disabled={isRedirecting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-black bg-primary-500 hover:bg-primary-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isRedirecting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Redirecting…
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        Pay ${listing.price.toFixed(2)}
                      </>
                    )}
                  </button>
                </div>

                <p className="text-center text-[10px] text-black flex items-center justify-center gap-1">
                  <ExternalLink className="w-2.5 h-2.5" />
                  You'll be redirected to Stripe's secure payment page
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PurchaseModal;
