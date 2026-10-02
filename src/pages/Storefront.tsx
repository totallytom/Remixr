import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingBag,
  Store,
  Plus,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Music,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Percent,
  Download,
  Receipt,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
  createStripeAccount,
  getStripeAccountStatus,
  getStripeDashboardLink,
  StripeAccountStatus,
} from '../services/api';
import { useBrowseStorefront, useArtistStorefront, usePurchaseHistory } from '../hooks/useStorefront';
import { StoreListing, LicenseType, CreateListingData, StorePurchaseWithDetails, StorefrontService } from '../services/storefrontService';
import StoreTrackCard from '../components/storefront/StoreTrackCard';
import PurchaseModal from '../components/storefront/PurchaseModal';
import StoreFiltersBar from '../components/storefront/StoreFilters';
import { useAlerts } from '../contexts/AlertContext';
import { REFUND_POLICY_FULL, STOREFRONT_SALES_ENABLED, SALES_PAUSED_MESSAGE } from '../config/storefrontPolicy';

// ─── Add Listing Form ──────────────────────────────────────────────────────────

interface AddListingFormProps {
  unlistedTracks: Array<{ id: string; title: string; artist: string }>;
  onAdd: (data: CreateListingData) => Promise<void>;
  onCancel: () => void;
}

const AddListingForm: React.FC<AddListingFormProps> = ({ unlistedTracks, onAdd, onCancel }) => {
  const [trackId, setTrackId] = useState('');
  const [price, setPrice] = useState('');
  const [licenseType, setLicenseType] = useState<LicenseType>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackId) { setFormError('Select a track'); return; }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0.99) { setFormError('Enter a price of at least $0.99'); return; }
    setIsSubmitting(true);
    setFormError(null);
    try {
      await onAdd({ trackId, price: priceNum, licenseType });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to list track');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-dark-800 border border-white/10 rounded-lg text-sm text-black px-3 py-2 focus:outline-none focus:border-primary-500/50';

  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="p-4 bg-dark-700/50 rounded-xl border border-white/10 space-y-3"
    >
      <h3 className="text-sm font-semibold text-black">List a Track for Sale</h3>

      {unlistedTracks.length === 0 ? (
        <p className="text-xs text-black py-2">All your tracks are already listed.</p>
      ) : (
        <>
          <select value={trackId} onChange={e => setTrackId(e.target.value)} className={inputClass}>
            <option value="">Select a track…</option>
            {unlistedTracks.map(t => (
              <option key={t.id} value={t.id}>{t.title} — {t.artist}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-black mb-1 block">Price (USD)</label>
              <input
                type="number"
                min="0.99"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="e.g. 4.99"
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-black/40 mb-1 block">License</label>
              <select
                value={licenseType}
                onChange={e => setLicenseType(e.target.value as LicenseType)}
                className={inputClass}
              >
                <option value="personal">Personal</option>
                <option value="commercial">Commercial</option>
                <option value="exclusive">Exclusive</option>
              </select>
            </div>
          </div>

          {formError && <p className="text-xs text-red-400">{formError}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 rounded-lg text-sm text-black/50 hover:text-black bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-black bg-primary-500 hover:bg-primary-400 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Listing…' : 'List Track'}
            </button>
          </div>
        </>
      )}
    </motion.form>
  );
};

// ─── Artist Listing Row ────────────────────────────────────────────────────────

interface ListingRowProps {
  listing: StoreListing;
  onToggle: (id: string, active: boolean) => Promise<void>;
  onEditPrice: (listing: StoreListing) => void;
}

const ListingRow: React.FC<ListingRowProps> = ({ listing, onToggle, onEditPrice }) => {
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try { await onToggle(listing.id, !listing.isActive); } finally { setToggling(false); }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl border border-white/5">
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0">
        {listing.cover ? (
          <img src={listing.cover} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-4 h-4 text-black/20" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-black truncate">{listing.title}</p>
        <p className="text-xs text-black/40">
          ${listing.price.toFixed(2)} · {listing.licenseType} · {listing.salesCount} sold
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => onEditPrice(listing)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-black/40 hover:text-black transition-colors"
          title="Edit price"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          title={listing.isActive ? 'Delist' : 'Relist'}
        >
          {listing.isActive ? (
            <ToggleRight className="w-4 h-4 text-green-400" />
          ) : (
            <ToggleLeft className="w-4 h-4 text-black/30" />
          )}
        </button>
      </div>
    </div>
  );
};

// ─── Edit Price Modal ──────────────────────────────────────────────────────────

interface EditPriceModalProps {
  listing: StoreListing | null;
  onClose: () => void;
  onSave: (id: string, price: number, licenseType: LicenseType) => Promise<void>;
}

const EditPriceModal: React.FC<EditPriceModalProps> = ({ listing, onClose, onSave }) => {
  const [price, setPrice] = useState(listing?.price.toFixed(2) ?? '');
  const [licenseType, setLicenseType] = useState<LicenseType>(listing?.licenseType ?? 'personal');
  const [isSaving, setIsSaving] = useState(false);

  if (!listing) return null;

  const inputClass =
    'w-full bg-dark-700 border border-white/10 rounded-lg text-sm text-black px-3 py-2 focus:outline-none focus:border-primary-500/50';

  const handleSave = async () => {
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0.99) return;
    setIsSaving(true);
    try { await onSave(listing.id, priceNum, licenseType); onClose(); } finally { setIsSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xs bg-dark-800 rounded-2xl border border-white/10 p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-black">Edit Listing</h3>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-black mb-1 block">Price (USD)</label>
            <input
              type="number" min="0.99" step="0.01"
              value={price} onChange={e => setPrice(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-black mb-1 block">License</label>
            <select
              value={licenseType} onChange={e => setLicenseType(e.target.value as LicenseType)}
              className={inputClass}
            >
              <option value="personal">Personal</option>
              <option value="commercial">Commercial</option>
              <option value="exclusive">Exclusive</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm text-black bg-white/5 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-black bg-primary-500 hover:bg-primary-400 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Purchase History Row ──────────────────────────────────────────────────────

const LICENSE_BADGE: Record<string, string> = {
  personal:   'text-blue-400 bg-blue-400/10',
  commercial: 'text-yellow-400 bg-yellow-400/10',
  exclusive:  'text-purple-400 bg-purple-400/10',
};

const PurchaseRow: React.FC<{ purchase: StorePurchaseWithDetails }> = ({ purchase }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const { downloadUrl } = await StorefrontService.getDownloadUrl(purchase.listingId);
      window.open(downloadUrl, '_blank');
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl border border-white/5">
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0">
        {purchase.cover ? (
          <img src={purchase.cover} alt={purchase.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-5 h-5 text-black/20" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-black truncate">{purchase.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-black/40 truncate">
            {purchase.sellerArtistName || purchase.sellerUsername}
          </p>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${LICENSE_BADGE[purchase.licenseType] ?? 'text-black/40 bg-white/10'}`}>
            {purchase.licenseType}
          </span>
        </div>
        {downloadError && <p className="text-[10px] text-red-400 mt-0.5">{downloadError}</p>}
      </div>

      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <p className="text-[10px] text-black/30">
          {new Date(purchase.purchasedAt).toLocaleDateString()}
        </p>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-black bg-primary-500/20 hover:bg-primary-500/30 border border-primary-500/30 rounded-lg transition-colors disabled:opacity-50"
        >
          {downloading ? (
            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Download className="w-3 h-3" />
          )}
          {downloading ? 'Getting link…' : `$${purchase.price.toFixed(2)} · Download`}
        </button>
      </div>
    </div>
  );
};

// ─── Storefront Page ───────────────────────────────────────────────────────────

type Tab = 'browse' | 'purchases' | 'my-store' | 'payments';

const PLATFORM_FEE_PCT = Number(import.meta.env.VITE_STOREFRONT_PLATFORM_FEE_PERCENT ?? 7);

const Storefront: React.FC = () => {
  const { user, playTrack, player } = useStore();
  const navigate = useNavigate();
  const { addAlert } = useAlerts();

  const isMusicianUser = user?.role === 'musician' || (user?.role as string) === 'Musician';

  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [selectedListing, setSelectedListing] = useState<StoreListing | null>(null);
  const [editingListing, setEditingListing] = useState<StoreListing | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // ── Payments tab state ───────────────────────────────────────────────────────
  // Checked live against Stripe: an account exists (connected) vs. it can
  // actually take payments and pay out (ready).
  const [payoutStatus, setPayoutStatus] = useState<StripeAccountStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const payoutReady = Boolean(payoutStatus?.ready);

  const refreshPayoutStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      setPayoutStatus(await getStripeAccountStatus(user.id));
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Could not check your payout account');
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !isMusicianUser) return;
    refreshPayoutStatus();
  }, [user?.id, isMusicianUser, refreshPayoutStatus]);

  // Back from Stripe onboarding (?stripe=return) or an expired link (?stripe=refresh).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeParam = params.get('stripe');
    if (stripeParam !== 'return' && stripeParam !== 'refresh') return;
    setActiveTab('payments');
    window.history.replaceState({}, '', window.location.pathname);
    if (stripeParam === 'refresh') {
      setConnectError('Your Stripe setup link expired. Click the button below to continue where you left off.');
    }
  }, []);

  const handleConnectStripe = useCallback(async () => {
    if (!user?.id) return;
    setIsConnecting(true);
    setConnectError(null);
    try {
      const { url } = await createStripeAccount(user.id);
      if (url) {
        window.location.href = url;
        return;
      }
      await refreshPayoutStatus(); // already fully set up
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Could not connect Stripe account');
    } finally {
      setIsConnecting(false);
    }
  }, [user?.id, refreshPayoutStatus]);

  const handleOpenStripeDashboard = useCallback(async () => {
    if (!user?.id) return;
    setConnectError(null);
    try {
      const { url } = await getStripeDashboardLink(user.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Could not open the Stripe dashboard');
    }
  }, [user?.id]);

  // Browse
  const {
    listings,
    filters,
    updateFilters,
    isLoading,
    error,
    purchasedIds,
    markPurchased,
    refreshPurchasedIds,
    genres,
  } = useBrowseStorefront();

  // Purchase history
  const {
    purchases: purchaseHistory,
    isLoading: purchaseHistoryLoading,
    error: purchaseHistoryError,
    reload: reloadPurchaseHistory,
  } = usePurchaseHistory();

  // Artist store
  const {
    listings: artistListings,
    unlistedTracks,
    isLoading: artistLoading,
    error: artistError,
    addListing,
    toggleActive,
    updatePrice,
    totalRevenue,
    totalSales,
  } = useArtistStorefront();

  // Detect return from Stripe Checkout (?checkout_success=1&listing_id=…).
  // The purchase is recorded by the Stripe webhook, which can land a few
  // seconds after the redirect, so poll until it shows up.
  const [finishingListingId, setFinishingListingId] = useState<string | null>(null);
  const [finishingTimedOut, setFinishingTimedOut] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout_success') !== '1') return;
    const listingId = params.get('listing_id');
    setActiveTab('purchases');
    window.history.replaceState({}, '', window.location.pathname);
    if (listingId) {
      markPurchased(listingId);
      setFinishingListingId(listingId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!finishingListingId) return;
    const POLL_MS = 2000;
    const TIMEOUT_MS = 60_000;
    const startedAt = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const rows = await reloadPurchaseHistory(true);
      if (cancelled) return;
      if (rows.some(p => p.listingId === finishingListingId)) {
        setFinishingListingId(null);
        refreshPurchasedIds();
        addAlert('Purchase complete! Your track is ready to download.', 'success');
        return;
      }
      if (Date.now() - startedAt >= TIMEOUT_MS) {
        setFinishingListingId(null);
        setFinishingTimedOut(true);
        return;
      }
      timer = setTimeout(poll, POLL_MS);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [finishingListingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlay = useCallback(
    (listing: StoreListing) => {
      playTrack({
        id: listing.trackId,
        title: listing.title,
        artist: listing.sellerArtistName || listing.artist,
        audioUrl: listing.audioUrl,
        cover: listing.cover ?? '',
        duration: listing.duration,
        genre: listing.genre ?? '',
        price: listing.price,
        album: '',
        boosted: false,
        previewOnly: !purchasedIds.has(listing.id),
      });
    },
    [playTrack, purchasedIds],
  );

  const handleBuy = useCallback(
    (listing: StoreListing) => {
      if (!user) { navigate('/login'); return; }
      setSelectedListing(listing);
    },
    [user, navigate],
  );

  const handleAddListing = useCallback(
    async (data: CreateListingData) => {
      await addListing(data);
      setShowAddForm(false);
      addAlert('Track listed in your store!', 'success');
    },
    [addListing, addAlert],
  );

  const handleUpdatePrice = useCallback(
    async (id: string, price: number, licenseType: LicenseType) => {
      await updatePrice(id, price, licenseType);
      addAlert('Listing updated.', 'success');
    },
    [updatePrice, addAlert],
  );

  return (
    <div className="px-4 py-6 lg:px-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-black/60 hover:text-black hover:bg-gray-100 active:scale-95 transition-all duration-200 flex-shrink-0"
          aria-label="Back to Home"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className="p-2 bg-primary-500/10 rounded-xl">
          <ShoppingBag className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-black">Storefront</h1>
          <p className="text-xs text-black/40">Buy and sell music directly</p>
        </div>
      </div>

      {/* Tab switcher — visible to all logged-in users */}
      {user && (
        <div className="flex gap-1 p-1 bg-dark-800/50 rounded-xl w-fit">
          {([
            { id: 'browse'    as Tab, label: 'Browse' },
            { id: 'purchases' as Tab, label: 'My Purchases' },
            ...(isMusicianUser ? [
              { id: 'my-store' as Tab, label: 'My Store' },
              { id: 'payments' as Tab, label: 'Payments' },
            ] : []),
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'bg-primary-500 text-black'
                  : 'text-black/50 hover:text-black'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Browse Tab ── */}
      {activeTab === 'browse' && (
        <div className="space-y-5">
          {!STOREFRONT_SALES_ENABLED && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-sm text-black/70">
              <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <span>{SALES_PAUSED_MESSAGE} You can still browse and preview tracks, and past purchases stay downloadable.</span>
            </div>
          )}
          <StoreFiltersBar filters={filters} genres={genres} onChange={updateFilters} />

          {isLoading ? (
            <div className="flex items-center justify-center min-h-[240px]">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-16 text-black/40 text-sm">{error}</div>
          ) : listings.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <ShoppingBag className="w-10 h-10 text-black/20 mx-auto" />
              <p className="text-black/40 text-sm">No tracks for sale yet.</p>
              {isMusicianUser && (
                <button
                  onClick={() => setActiveTab('my-store')}
                  className="text-primary-400 text-sm underline underline-offset-2"
                >
                  List your tracks
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {listings.map(listing => (
                <StoreTrackCard
                  key={listing.id}
                  listing={listing}
                  isPurchased={purchasedIds.has(listing.id)}
                  isPlaying={
                    player.currentTrack?.id === listing.trackId && player.isPlaying
                  }
                  onPlay={handlePlay}
                  onBuy={handleBuy}
                  onDownloadError={msg => addAlert(msg, 'error')}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── My Purchases Tab ── */}
      {activeTab === 'purchases' && user && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary-400" />
            <h2 className="text-sm font-semibold text-black">My Purchases</h2>
            {purchaseHistory.length > 0 && (
              <span className="text-xs text-black/30">{purchaseHistory.length} track{purchaseHistory.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {finishingListingId && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-primary-500/20 bg-primary-500/5 text-sm text-black/70">
              <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              Payment received — finishing your purchase. Your download will appear here in a moment.
            </div>
          )}
          {finishingTimedOut && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-sm text-black/70">
              <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <span>
                Your payment went through, but we're still processing the purchase. Refresh this page in a
                minute. If it still isn't here, contact support with your Stripe receipt — you won't be charged twice.
              </span>
            </div>
          )}

          {purchaseHistoryLoading ? (
            <div className="flex items-center justify-center min-h-[240px]">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : purchaseHistoryError ? (
            <div className="text-center py-16 text-black/40 text-sm">{purchaseHistoryError}</div>
          ) : purchaseHistory.length === 0 && !finishingListingId ? (
            <div className="text-center py-16 space-y-3">
              <ShoppingBag className="w-10 h-10 text-black/20 mx-auto" />
              <p className="text-black/40 text-sm">You haven't purchased any tracks yet.</p>
              <button
                onClick={() => setActiveTab('browse')}
                className="text-primary-400 text-sm underline underline-offset-2"
              >
                Browse the store
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {purchaseHistory.map(purchase => (
                <PurchaseRow key={purchase.id} purchase={purchase} />
              ))}
            </div>
          )}

          <p className="text-xs text-black/40 pt-2">
            <span className="font-medium text-black/50">Refund policy: </span>
            {REFUND_POLICY_FULL}
          </p>
        </div>
      )}

      {/* ── My Store Tab ── */}
      {activeTab === 'my-store' && isMusicianUser && (
        <div className="space-y-5">

          {/* Stripe Connect gate */}
          {!payoutReady && !user?.isAdmin && (
            <div className="p-6 bg-dark-800/50 rounded-2xl border border-yellow-500/20 text-center space-y-3">
              <Building2 className="w-8 h-8 text-yellow-400 mx-auto" />
              <p className="text-black font-semibold">
                {payoutStatus?.connected ? 'Finish your Stripe setup to start selling' : 'Connect Stripe to start selling'}
              </p>
              <p className="text-black/40 text-sm">
                {payoutStatus?.connected
                  ? 'Stripe still needs a few details before you can receive payments.'
                  : 'You need a connected payout account before you can list tracks or receive payments.'}
              </p>
              <button
                onClick={() => setActiveTab('payments')}
                className="px-5 py-2.5 bg-[#635BFF] hover:bg-[#7A73FF] text-black text-sm font-semibold rounded-xl transition-colors"
              >
                {payoutStatus?.connected ? 'Go to Payments → Finish setup' : 'Go to Payments → Connect Stripe'}
              </button>
            </div>
          )}

          {/* Stats */}
          {(payoutReady || user?.isAdmin) && (<>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Listings', value: artistListings.length },
              { label: 'Total Sales', value: totalSales },
              { label: 'Est. Revenue', value: `$${totalRevenue.toFixed(2)}` },
            ].map(stat => (
              <div
                key={stat.label}
                className="p-4 bg-dark-800/50 rounded-xl border border-white/5 text-center"
              >
                <p className="text-xl font-bold text-black">{stat.value}</p>
                <p className="text-xs text-black/40 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Add listing */}
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 w-full py-3 px-4 bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 rounded-xl text-primary-400 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              List a Track for Sale
            </button>
          ) : (
            <AddListingForm
              unlistedTracks={unlistedTracks}
              onAdd={handleAddListing}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {/* Listing rows */}
          {artistLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : artistError ? (
            <p className="text-sm text-red-400">{artistError}</p>
          ) : artistListings.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Store className="w-10 h-10 text-black/20 mx-auto" />
              <p className="text-sm text-black/40">You haven't listed any tracks yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {artistListings.map(listing => (
                <ListingRow
                  key={listing.id}
                  listing={listing}
                  onToggle={toggleActive}
                  onEditPrice={setEditingListing}
                />
              ))}
            </div>
          )}
          </>)}
        </div>
      )}

      {/* ── Payments Tab ── */}
      {activeTab === 'payments' && isMusicianUser && (
        <div className="space-y-4 max-w-xl">

          {/* ── Stripe Connect ─────────────────────────────────────────────── */}
          <div className="p-5 bg-dark-800/50 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary-400" />
              <h2 className="text-sm font-semibold text-black">Payout Account</h2>
            </div>

            {payoutReady ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Stripe account connected — ready to sell</span>
                </div>
                <p className="text-xs text-black/40">
                  Track sale revenue is automatically deposited to your connected bank account
                  after Stripe's standard payout schedule (typically 2 business days).
                </p>
                {connectError && (
                  <p className="text-xs text-red-400">{connectError}</p>
                )}
                <button
                  onClick={handleOpenStripeDashboard}
                  className="inline-flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                >
                  Manage payouts in Stripe
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-yellow-400/80 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {payoutStatus?.connected
                      ? "Your Stripe setup isn't finished yet. Buyers can't purchase your tracks until Stripe has everything it needs."
                      : "No payout account connected. You won't receive earnings from sales until you complete Stripe onboarding."}
                  </span>
                </div>
                <p className="text-xs text-black/40">
                  Stripe Express lets you receive direct bank deposits. Setup takes about
                  5 minutes and requires your bank details and ID verification.
                </p>
                {connectError && (
                  <p className="text-xs text-red-400">{connectError}</p>
                )}
                <button
                  onClick={handleConnectStripe}
                  disabled={isConnecting}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#635BFF] hover:bg-[#7A73FF] text-black text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {isConnecting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Building2 className="w-4 h-4" />
                  )}
                  {isConnecting
                    ? 'Redirecting to Stripe…'
                    : payoutStatus?.connected ? 'Continue Stripe setup' : 'Connect with Stripe'}
                </button>
              </div>
            )}
          </div>

          {/* ── Purchase Methods ────────────────────────────────────────────── */}
          <div className="p-5 bg-dark-800/50 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary-400" />
              <h2 className="text-sm font-semibold text-black">Accepted Payment Methods</h2>
            </div>

            <div className="space-y-2">
              {[
                { label: 'Credit / Debit Card', detail: 'Visa, Mastercard, Amex, Discover', enabled: true },
                { label: 'Apple Pay', detail: 'Enabled automatically on supported browsers', enabled: true },
                { label: 'Google Pay', detail: 'Enabled automatically on supported browsers', enabled: true },
              ].map(method => (
                <div
                  key={method.label}
                  className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"
                >
                  <div>
                    <p className="text-sm text-black">{method.label}</p>
                    <p className="text-xs text-black/40">{method.detail}</p>
                  </div>
                  <span className="text-xs font-medium text-green-400">Active</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-black/30">
              Payment methods are managed by Stripe and enabled based on the buyer's
              device and region.
            </p>
          </div>

          {/* ── Transaction Settings ────────────────────────────────────────── */}
          <div className="p-5 bg-dark-800/50 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary-400" />
              <h2 className="text-sm font-semibold text-black">Transaction Settings</h2>
            </div>

            <div className="space-y-3">
              {[
                {
                  label: 'Platform fee',
                  value: `${PLATFORM_FEE_PCT}%`,
                  detail: 'Deducted per sale before your payout',
                },
                {
                  label: 'Payment processor fee',
                  value: '2.9% + 30¢',
                  detail: "Stripe's standard card processing fee",
                },
                {
                  label: 'Settlement currency',
                  value: 'USD',
                  detail: 'All transactions are processed in US dollars',
                },
                {
                  label: 'Payout schedule',
                  value: '2 business days',
                  detail: 'After each successful sale (Stripe standard)',
                },
              ].map(row => (
                <div
                  key={row.label}
                  className="flex items-start justify-between py-2.5 border-b border-white/5 last:border-0 gap-4"
                >
                  <div>
                    <p className="text-sm text-black">{row.label}</p>
                    <p className="text-xs text-black/40">{row.detail}</p>
                  </div>
                  <span className="text-sm font-semibold text-black flex-shrink-0">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-white/5 rounded-lg">
              <p className="text-xs text-black/40">
                Example: on a <span className="text-black">$10.00</span> sale you receive approximately{' '}
                <span className="text-green-400 font-medium">
                  ${(10 - 10 * (PLATFORM_FEE_PCT / 100) - 10 * 0.029 - 0.30).toFixed(2)}
                </span>{' '}
                after fees.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* Purchase modal */}
      <PurchaseModal
        listing={selectedListing}
        isOpen={!!selectedListing}
        onClose={() => setSelectedListing(null)}
      />

      {/* Edit price modal */}
      <EditPriceModal
        listing={editingListing}
        onClose={() => setEditingListing(null)}
        onSave={handleUpdatePrice}
      />
    </div>
  );
};

export default Storefront;
