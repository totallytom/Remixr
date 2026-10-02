// api/download-purchase.js
// Returns a short-lived signed URL for a track's audio file. Two modes:
//
//   GET /api/download-purchase?listing_id={id}  – a Storefront purchase
//   GET /api/download-purchase?track_id={id}    – the artist's download setting
//        (tracks.download_policy: off | free | followers | paid; checked by the
//         download_access() database function; each download is logged)
//
// One function for both so the project stays within Vercel's function limit.
// The signed URL expires after 1 hour.
// Headers: Authorization: Bearer <supabase_jwt>
// Returns: { downloadUrl: string, filename: string, expiresAt: string }

const { createClient } = require('@supabase/supabase-js');
const { isUUID } = require('./_validate');

const BUCKET = 'music-files';
// Public URL prefix produced by Supabase getPublicUrl() — path starts after this.
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;
// Signed URL prefix to handle cases where audio_url is already signed.
const SIGNED_PREFIX = `/storage/v1/object/sign/${BUCKET}/`;

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Extract the Supabase Storage object path from a full storage URL.
// Handles both public and previously-signed URLs.
function extractStoragePath(audioUrl) {
  try {
    const pathname = new URL(audioUrl).pathname;
    if (pathname.includes(PUBLIC_PREFIX)) {
      return decodeURIComponent(pathname.slice(pathname.indexOf(PUBLIC_PREFIX) + PUBLIC_PREFIX.length));
    }
    if (pathname.includes(SIGNED_PREFIX)) {
      // Signed URL path has a token query param — just need the path segment.
      const pathPart = pathname.slice(pathname.indexOf(SIGNED_PREFIX) + SIGNED_PREFIX.length);
      return decodeURIComponent(pathPart);
    }
  } catch {
    // URL parsing failed — fall through.
  }
  return null;
}

// Derive a human-readable filename from the storage path.
function deriveFilename(storagePath, trackTitle, artist) {
  const ext = storagePath.split('.').pop()?.toLowerCase() ?? 'mp3';
  const safeName = `${artist} - ${trackTitle}`.replace(/[^a-zA-Z0-9 \-_]/g, '').trim();
  return `${safeName}.${ext}`;
}

const ACCESS_DENIED_MESSAGES = {
  not_found: 'Track not found.',
  unavailable: 'This track is not available right now.',
  off: "The artist hasn't turned on downloads for this track.",
  sign_in: 'Sign in to download.',
  follow: 'Follow the artist to download this track.',
  buy: 'This track is available to download after buying it on the Storefront.',
};

async function downloadTrack(trackId, user, res) {
  if (!isUUID(trackId)) return res.status(400).json({ error: 'Invalid track_id' });

  const { data: access, error: accessError } = await supabase.rpc('download_access', {
    p_track_id: trackId,
    p_user_id: user.id,
  });
  if (accessError) {
    console.error('download_access failed:', accessError.message);
    return res.status(500).json({ error: 'Could not check download access' });
  }
  if (!access?.allowed) {
    return res.status(access?.reason === 'not_found' ? 404 : 403).json({
      error: ACCESS_DENIED_MESSAGES[access?.reason] ?? 'You can’t download this track.',
      code: access?.reason ?? 'denied',
    });
  }

  const { data: track, error: trackError } = await supabase
    .from('tracks')
    .select('title, artist, audio_url')
    .eq('id', trackId)
    .maybeSingle();
  if (trackError || !track?.audio_url) {
    return res.status(404).json({ error: 'No audio file for this track' });
  }

  const storagePath = extractStoragePath(track.audio_url);
  if (!storagePath) return res.status(500).json({ error: 'Could not resolve audio file location' });

  const filename = deriveFilename(storagePath, track.title, track.artist);
  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, { download: filename });
  if (signError || !signed?.signedUrl) {
    console.error('Signed URL creation failed:', signError?.message);
    return res.status(500).json({ error: 'Could not generate download link' });
  }

  // Count real downloads (the owner's own downloads aren't logged).
  if (access.reason !== 'owner') {
    const { error: logError } = await supabase.from('track_downloads').insert({ track_id: trackId, user_id: user.id });
    if (logError) console.error('track_downloads insert failed:', logError.message);
  }

  return res.json({
    downloadUrl: signed.signedUrl,
    filename,
    expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 1. Authenticate buyer ──────────────────────────────────────────────────
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  // ── Track download (artist's download setting) ─────────────────────────────
  if (req.query?.track_id) {
    return downloadTrack(req.query.track_id, user, res);
  }

  // ── 2. Validate query param ────────────────────────────────────────────────
  const listingId = req.query?.listing_id;
  if (!listingId) return res.status(400).json({ error: 'Missing listing_id' });
  if (!isUUID(listingId)) return res.status(400).json({ error: 'Invalid listing_id' });

  // ── 3. Verify completed purchase ───────────────────────────────────────────
  // limit(1): a buyer can end up with more than one row for the same listing
  // (duplicate charges are auto-refunded, but older rows may exist).
  const { data: purchases, error: purchaseError } = await supabase
    .from('store_purchases')
    .select('id, license_type')
    .eq('listing_id', listingId)
    .eq('buyer_id', user.id)
    .eq('status', 'completed')
    .order('purchased_at', { ascending: true })
    .limit(1);

  if (purchaseError) {
    console.error('Purchase lookup error:', purchaseError.message);
    return res.status(500).json({ error: 'Could not verify purchase' });
  }
  if (!purchases?.length) {
    return res.status(403).json({ error: 'No completed purchase found for this listing' });
  }

  // ── 4. Fetch track audio URL ───────────────────────────────────────────────
  const { data: listing, error: listingError } = await supabase
    .from('store_listings')
    .select('tracks:track_id ( title, artist, audio_url, status )')
    .eq('id', listingId)
    .maybeSingle();

  if (listingError || !listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  const track = Array.isArray(listing.tracks) ? listing.tracks[0] : listing.tracks;
  // Tracks taken down for copyright (or removed by moderation) can't be
  // distributed, even to earlier buyers.
  if (track && (track.status === 'disabled' || track.status === 'removed')) {
    return res.status(451).json({
      error: 'This track has been taken down and is no longer available for download. If this was a recent purchase, contact support about a refund.',
    });
  }
  if (!track?.audio_url) {
    return res.status(500).json({ error: 'No audio file associated with this track' });
  }

  // ── 5. Extract storage path and create signed URL ─────────────────────────
  const storagePath = extractStoragePath(track.audio_url);
  if (!storagePath) {
    console.error('Could not extract storage path from audio_url');
    return res.status(500).json({ error: 'Could not resolve audio file location' });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, {
      download: deriveFilename(storagePath, track.title, track.artist),
    });

  if (signError || !signed?.signedUrl) {
    console.error('Signed URL creation failed:', signError?.message);
    return res.status(500).json({ error: 'Could not generate download link' });
  }

  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

  return res.json({
    downloadUrl: signed.signedUrl,
    filename: deriveFilename(storagePath, track.title, track.artist),
    expiresAt,
  });
};
