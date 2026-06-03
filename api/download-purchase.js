// api/download-purchase.js
// Returns a short-lived signed URL for a purchased track's audio file.
// The signed URL expires after 1 hour — buyers must re-request for subsequent downloads.
//
// GET /api/download-purchase?listing_id={id}
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

  // ── 2. Validate query param ────────────────────────────────────────────────
  const listingId = req.query?.listing_id;
  if (!listingId) return res.status(400).json({ error: 'Missing listing_id' });
  if (!isUUID(listingId)) return res.status(400).json({ error: 'Invalid listing_id' });

  // ── 3. Verify completed purchase ───────────────────────────────────────────
  const { data: purchase, error: purchaseError } = await supabase
    .from('store_purchases')
    .select('id, license_type')
    .eq('listing_id', listingId)
    .eq('buyer_id', user.id)
    .eq('status', 'completed')
    .maybeSingle();

  if (purchaseError) {
    console.error('Purchase lookup error:', purchaseError.message);
    return res.status(500).json({ error: 'Could not verify purchase' });
  }
  if (!purchase) {
    return res.status(403).json({ error: 'No completed purchase found for this listing' });
  }

  // ── 4. Fetch track audio URL ───────────────────────────────────────────────
  const { data: listing, error: listingError } = await supabase
    .from('store_listings')
    .select('tracks:track_id ( title, artist, audio_url )')
    .eq('id', listingId)
    .maybeSingle();

  if (listingError || !listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  const track = Array.isArray(listing.tracks) ? listing.tracks[0] : listing.tracks;
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
