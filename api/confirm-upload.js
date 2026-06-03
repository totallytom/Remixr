// POST /api/confirm-upload
// Verifies the HMAC uploadToken issued by request-upload-token, confirms the
// audio file exists in storage with a plausible size, then inserts the track row.
//
// The path, title, and artist all come from the verified token — never from the
// client — which closes the TOCTOU path-ownership bypass and the metadata-swap
// race condition identified in the security audit.
//
// Body:    { uploadToken, album?, genre, duration, coverUrl,
//            albumId?, previewStartSec?, previewDurationSec? }
// Returns: { id }

const { createClient }               = require('@supabase/supabase-js');
const { createHmac, timingSafeEqual } = require('crypto');
const { isUUID, truncate }            = require('./_validate');

// ── HMAC token verification ──────────────────────────────────────────────────

function verifyUploadToken(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) throw new Error('Invalid token');

  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Malformed token');
  }

  const { data, sig } = parsed;
  if (!data || typeof data !== 'string' || typeof sig !== 'string') throw new Error('Malformed token');

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Server misconfigured');

  const expected    = createHmac('sha256', secret).update(data).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const sigBuf      = Buffer.from(sig,      'hex');

  // Length mismatch means tampered sig — reject before constant-time compare
  if (sigBuf.length !== expectedBuf.length) throw new Error('Invalid token signature');
  if (!timingSafeEqual(expectedBuf, sigBuf)) throw new Error('Invalid token signature');

  let payload;
  try { payload = JSON.parse(data); } catch { throw new Error('Malformed token payload'); }

  if (Date.now() > payload.expiresAt) throw new Error('Token expired');
  return payload;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_COVER      = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';
const MIN_AUDIO_BYTES    = 10_000;     // 10 KB — any real audio file exceeds this
const MAX_DURATION_SECS  = 3 * 3600;  // 3 hours
const MAX_PREVIEW_DUR    = 60;        // 60 seconds max preview

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Auth ──
  const authHeader  = req.headers['authorization'] ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!bearerToken) return res.status(401).json({ error: 'Missing authorization token' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(bearerToken);
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  // ── Verify HMAC upload token ──
  // The token was issued by request-upload-token and contains the server-chosen
  // path plus the copyright-checked title and artist. Using these server-side
  // values eliminates TOCTOU and prevents the caller from swapping metadata.
  const { uploadToken, album, genre, duration, coverUrl, albumId, previewStartSec, previewDurationSec } = req.body ?? {};

  if (!uploadToken) return res.status(400).json({ error: 'Missing uploadToken' });

  let tokenPayload;
  try {
    tokenPayload = verifyUploadToken(uploadToken);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid or expired upload token', code: 'token_invalid' });
  }

  // Caller must be the same user who requested the token
  if (tokenPayload.userId !== user.id) return res.status(403).json({ error: 'Forbidden' });

  const { path, title, artist } = tokenPayload;

  // ── Remaining field validation ──
  if (!genre || duration == null) {
    return res.status(400).json({ error: 'Missing required fields: genre, duration' });
  }
  if (typeof genre !== 'string' || genre.length > 100) return res.status(400).json({ error: 'Invalid genre' });

  // Validate duration with finite bounds (prevents Infinity / MAX_SAFE_INTEGER in DB)
  if (typeof duration !== 'number' || !isFinite(duration) || duration < 0 || duration > MAX_DURATION_SECS) {
    return res.status(400).json({ error: 'Invalid duration' });
  }

  // Validate preview fields
  const safeDur          = Math.floor(duration);
  const safePreviewStart = (typeof previewStartSec  === 'number' && isFinite(previewStartSec)  && previewStartSec  >= 0 && previewStartSec  < safeDur) ? Math.floor(previewStartSec)  : 0;
  const safePreviewDur   = (typeof previewDurationSec === 'number' && isFinite(previewDurationSec) && previewDurationSec > 0 && previewDurationSec <= MAX_PREVIEW_DUR) ? Math.floor(previewDurationSec) : 20;

  // Validate albumId if present — must be a valid UUID owned by this user
  if (albumId !== undefined && albumId !== null) {
    if (!isUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    const { data: albumRow } = await supabase
      .from('albums')
      .select('user_id')
      .eq('id', albumId)
      .maybeSingle();
    if (!albumRow || albumRow.user_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
  }

  // Validate coverUrl — must be a Supabase Storage URL on this project or empty
  if (coverUrl) {
    const supabaseBase = process.env.SUPABASE_URL;
    const allowedPrefix = `${supabaseBase}/storage/v1/object/public/music-files/playlist-covers/`;
    if (typeof coverUrl !== 'string' || !coverUrl.startsWith(allowedPrefix)) {
      return res.status(400).json({ error: 'Invalid cover URL' });
    }
  }

  // ── Verify file exists in storage with plausible size ──
  // Confirms the upload actually completed and wasn't a 1-byte fake.
  const parts            = path.split('/');
  const fileNameInStorage = parts.pop();
  const folderPath        = parts.join('/');

  const { data: listing, error: listError } = await supabase.storage
    .from('music-files')
    .list(folderPath, { search: fileNameInStorage, limit: 1 });

  if (listError || !listing?.length) {
    return res.status(400).json({ error: 'Audio file not found. The upload may have failed.', code: 'file_not_found' });
  }

  const uploadedSize = listing[0]?.metadata?.size ?? listing[0]?.size ?? 0;
  if (uploadedSize < MIN_AUDIO_BYTES) {
    return res.status(400).json({ error: 'Uploaded file is too small to be valid audio.', code: 'file_invalid' });
  }

  // ── Insert track row ──
  const audioUrl = supabase.storage.from('music-files').getPublicUrl(path).data.publicUrl;

  const trackRow = {
    title:               truncate(title,  200).trim(),
    artist:              truncate(artist, 200).trim(),
    album:               album ? truncate(album, 200).trim() : null,
    duration:            safeDur,
    cover:               coverUrl || DEFAULT_COVER,
    audio_url:           audioUrl,
    genre:               truncate(genre, 100).trim(),
    user_id:             user.id,
    preview_start_sec:   safePreviewStart,
    preview_duration_sec: safePreviewDur,
    created_at:          new Date().toISOString(),
    updated_at:          new Date().toISOString(),
  };

  if (albumId) trackRow.album_id = albumId;

  const { data: track, error: insertError } = await supabase
    .from('tracks')
    .insert(trackRow)
    .select('id')
    .single();

  if (insertError) {
    console.error('confirm-upload: insert failed');
    return res.status(500).json({ error: 'Failed to save track. Please try again.' });
  }

  return res.json({ id: track.id });
};
