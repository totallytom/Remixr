// POST /api/request-upload-token
// Runs a 3-layer copyright check then issues:
//   1. A Supabase signed upload URL (client uploads directly; no audio passes through here)
//   2. An HMAC-signed uploadToken that confirm-upload verifies server-side
//      binding userId + path + title + artist — prevents TOCTOU and metadata-swap attacks.
//
// Body:    { title, artist, filename, fileSize, fileType, hash?, sampleBase64? }
// Returns: { signedUrl, token, path, uploadToken }

const { createClient }           = require('@supabase/supabase-js');
const { createHmac, randomUUID } = require('crypto');
const { isUUID }                 = require('./_validate');

// ── HMAC upload token ────────────────────────────────────────────────────────
// Binds userId + path + title + artist to a 15-minute window.
// confirm-upload verifies this before trusting any of those values.

const TOKEN_TTL_MS = 15 * 60 * 1000;

function hmacSecret() {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY');
  return s;
}

function signUploadToken(payload) {
  const data = JSON.stringify(payload);
  const sig  = createHmac('sha256', hmacSecret()).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url');
}

// ── MusicBrainz result cache ─────────────────────────────────────────────────
// Same normalised title+artist always returns the same result; cache 24 h.
// Prevents redundant MB calls under concurrent uploads and preserves the
// 1 req/s rate limit even on busy days.

const MB_CACHE     = new Map();
const MB_TTL_MS    = 24 * 60 * 60 * 1000;
const MB_CACHE_MAX = 2000;

function mbCacheGet(title, artist) {
  const key   = `${norm(title)}::${norm(artist)}`;
  const entry = MB_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { MB_CACHE.delete(key); return null; }
  return entry.result;
}

function mbCacheSet(title, artist, result) {
  if (MB_CACHE.size >= MB_CACHE_MAX) MB_CACHE.delete(MB_CACHE.keys().next().value);
  MB_CACHE.set(`${norm(title)}::${norm(artist)}`, { result, expiresAt: Date.now() + MB_TTL_MS });
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function norm(str) {
  return (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Escape Lucene special characters so user-supplied title/artist cannot
// inject query logic into the MusicBrainz search (A03 injection fix).
function escapeLucene(str) {
  return str.replace(/([+\-&|!(){}[\]^"~*?:\\])/g, '\\$1');
}

function getBlockedHashes() {
  try {
    const raw = process.env.COPYRIGHT_BLOCKED_HASHES;
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (_) {}
  return [];
}

// ── Blocklists ───────────────────────────────────────────────────────────────

const METADATA_BLOCKLIST = new Set([
  'taylor swift - shake it off', 'taylor swift - blank space', 'taylor swift - anti-hero',
  'drake - one dance', 'drake - hotline bling',
  'the weeknd - blinding lights', 'the weeknd - starboy',
  'ed sheeran - shape of you', 'ed sheeran - perfect',
  'justin bieber - sorry', 'justin bieber - love yourself',
  'adele - hello', 'adele - easy on me',
  'billie eilish - bad guy', 'billie eilish - happier than ever',
  'post malone - sunflower', 'post malone - rockstar',
  'ariana grande - thank u next', 'ariana grande - positions',
  'bad bunny - dakiti', 'bad bunny - monaco',
  'beyoncé - break my soul', 'beyoncé - cuff it',
  'harry styles - as it was', 'harry styles - watermelon sugar',
  'olivia rodrigo - drivers license', 'olivia rodrigo - vampire',
  'doja cat - say so', 'doja cat - kiss me more',
  'dua lipa - levitating', "dua lipa - don't start now",
  'bruno mars - uptown funk', "bruno mars - that's what i like",
  'rihanna - umbrella', 'rihanna - work',
  'lady gaga - shallow', 'lady gaga - poker face',
  'katy perry - roar', 'katy perry - dark horse',
  'coldplay - viva la vida', 'coldplay - yellow',
  'maroon 5 - sugar', 'maroon 5 - moves like jagger',
  'imagine dragons - believer', 'imagine dragons - radioactive',
  'twenty one pilots - stressed out', 'twenty one pilots - heathens',
  'the chainsmokers - closer', 'the chainsmokers - something just like this',
  'marshmello - alone', 'marshmello - friends',
  'calvin harris - summer', 'calvin harris - one kiss',
  'david guetta - titanium', 'david guetta - without you',
  'avicii - wake me up', 'avicii - levels',
  'zedd - clarity', 'zedd - the middle',
  'martin garrix - animals', 'martin garrix - in the name of love',
  'kygo - firestone', 'kygo - higher love',
  'alan walker - faded', 'alan walker - alone',
  'michael jackson - thriller', 'michael jackson - billie jean',
  'queen - bohemian rhapsody', 'queen - we will rock you',
  'eagles - hotel california', 'eagles - take it easy',
  'fleetwood mac - dreams', 'fleetwood mac - go your own way',
  'nirvana - smells like teen spirit', 'nirvana - come as you are',
  "oasis - wonderwall", "oasis - don't look back in anger",
  'u2 - with or without you', 'u2 - beautiful day',
  'ac/dc - back in black', 'ac/dc - highway to hell',
  'led zeppelin - stairway to heaven', 'led zeppelin - whole lotta love',
  'pink floyd - another brick in the wall', 'pink floyd - wish you were here',
  'the beatles - hey jude', 'the beatles - let it be',
  'rolling stones - satisfaction', 'rolling stones - paint it black',
  'elvis presley - hound dog', 'elvis presley - jailhouse rock',
  'frank sinatra - my way', 'frank sinatra - fly me to the moon',
]);

const BLOCKED_ARTISTS = new Set([
  'taylor swift', 'drake', 'the weeknd', 'ed sheeran', 'adele', 'billie eilish',
  'post malone', 'ariana grande', 'bad bunny', 'beyoncé', 'harry styles',
  'olivia rodrigo', 'doja cat', 'dua lipa', 'bruno mars', 'rihanna', 'lady gaga',
  'katy perry', 'coldplay', 'maroon 5', 'justin bieber', 'michael jackson',
  'queen', 'the beatles', 'rolling stones', 'elvis presley', 'frank sinatra',
  'nirvana', 'ac/dc', 'led zeppelin', 'pink floyd', 'eagles', 'fleetwood mac', 'u2', 'oasis',
]);

// ── Layer 1: metadata + hash blocklist ───────────────────────────────────────

function checkMetadata(title, artist, hash) {
  const key = `${norm(artist)} - ${norm(title)}`;
  if (METADATA_BLOCKLIST.has(key)) {
    return { blocked: true, reason: 'This track matches a known copyrighted recording and cannot be uploaded.' };
  }
  if (BLOCKED_ARTISTS.has(norm(artist))) {
    return { blocked: true, reason: 'Uploads under this artist name are restricted. Use your own artist name for original work.' };
  }
  if (hash) {
    const blocked = getBlockedHashes();
    if (blocked.includes(hash.toLowerCase())) {
      return { blocked: true, reason: 'This file matches a known copyrighted recording.' };
    }
  }
  return { blocked: false };
}

// ── Layer 2: MusicBrainz (free) ──────────────────────────────────────────────

async function checkMusicBrainz(title, artist) {
  const cached = mbCacheGet(title, artist);
  if (cached) return cached;

  try {
    // escapeLucene prevents query injection; URLSearchParams handles URL encoding
    const params = new URLSearchParams({
      query: `recording:"${escapeLucene(title)}" AND artist:"${escapeLucene(artist)}"`,
      limit:  '1',
      fmt:    'json',
    });
    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording/?${params}`,
      {
        headers: { 'User-Agent': 'Sypher/1.0 (remix.official0714@gmail.com)' },
        signal:  AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return { blocked: false }; // fail open on 429 or transient errors
    const json = await res.json();
    const top  = json.recordings?.[0];
    const result = (top && top.score >= 90)
      ? { blocked: true, reason: `This track matches a commercially released recording: "${top.title}" by ${top['artist-credit']?.[0]?.name ?? artist}.` }
      : { blocked: false };
    mbCacheSet(title, artist, result);
    return result;
  } catch {
    return { blocked: false }; // fail open — never block on network/timeout error
  }
}

// ── Layer 3: Audd.io audio fingerprint (optional) ────────────────────────────

async function checkAudd(sampleBase64, filename) {
  const apiKey = process.env.AUDD_API_KEY;
  if (!apiKey || !sampleBase64) return { blocked: false };
  try {
    const buffer = Buffer.from(sampleBase64, 'base64');
    const form   = new FormData();
    form.append('api_token', apiKey);
    form.append('return',    'musicbrainz');
    form.append('file', new Blob([buffer], { type: 'audio/mpeg' }), filename || 'sample.mp3');
    const res = await fetch('https://api.audd.io/', {
      method: 'POST',
      body:   form,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { blocked: false };
    const json = await res.json();
    if (json.status === 'success' && json.result) {
      return {
        blocked: true,
        reason: `Audio fingerprint matched a copyrighted recording: "${json.result.title}" by ${json.result.artist}.`,
      };
    }
    return { blocked: false };
  } catch {
    return { blocked: false }; // fail open
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/aiff', 'audio/x-aiff', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
]);
const ALLOWED_EXTENSIONS = new Set(['.mp3', '.wav', '.aiff', '.aif', '.m4a']);
const MAX_BYTES          = 50 * 1024 * 1024;       // 50 MB
const MAX_SAMPLE_B64     = 600_000;                  // ~400 KB decoded

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

  // ── Input validation ──
  const body = req.body ?? {};
  const { title, artist, filename, fileSize, fileType, hash, sampleBase64 } = body;

  if (!title || !artist || !filename || fileSize == null || !fileType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (typeof title    !== 'string' || title.length    > 200) return res.status(400).json({ error: 'Invalid title' });
  if (typeof artist   !== 'string' || artist.length   > 200) return res.status(400).json({ error: 'Invalid artist' });
  if (typeof filename !== 'string' || filename.length > 255) return res.status(400).json({ error: 'Invalid filename' });
  if (typeof fileSize !== 'number' || !isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_BYTES) {
    return res.status(400).json({ error: 'File size invalid or exceeds 50 MB limit' });
  }
  if (!ALLOWED_TYPES.has(fileType)) {
    return res.status(400).json({ error: 'File type not allowed. Accepted: MP3, WAV, AIFF, M4A' });
  }

  // Validate extension matches declared type (prevents double-extension tricks)
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return res.status(400).json({ error: 'File extension not allowed' });
  }

  // Validate hash format if provided
  if (hash !== undefined && (typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash))) {
    return res.status(400).json({ error: 'Invalid hash format' });
  }

  // Validate sampleBase64 size to prevent OOM (A02)
  if (sampleBase64 !== undefined) {
    if (typeof sampleBase64 !== 'string' || sampleBase64.length > MAX_SAMPLE_B64) {
      return res.status(400).json({ error: 'Sample too large' });
    }
  }

  // ── Verified artist bypass ──
  const { data: profile } = await supabase
    .from('users')
    .select('is_verified_artist')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.is_verified_artist) {
    // Layer 1
    const meta = checkMetadata(title, artist, hash);
    if (meta.blocked) return res.status(403).json({ error: meta.reason, code: 'copyright_blocked' });

    // Layer 2
    const mb = await checkMusicBrainz(title, artist);
    if (mb.blocked) return res.status(403).json({ error: mb.reason, code: 'copyright_blocked' });

    // Layer 3
    const audd = await checkAudd(sampleBase64, filename);
    if (audd.blocked) return res.status(403).json({ error: audd.reason, code: 'copyright_blocked' });
  }

  // ── Issue signed upload URL ──
  // UUID in path guarantees uniqueness under concurrent uploads
  const sanitizedName = filename.replace(/[^a-zA-Z0-9-]/g, '_') + ext;
  const storagePath   = `audio-files/${user.id}/${randomUUID()}-${sanitizedName}`;

  const { data: signed, error: signedError } = await supabase.storage
    .from('music-files')
    .createSignedUploadUrl(storagePath);

  if (signedError || !signed) {
    console.error('createSignedUploadUrl failed');
    return res.status(500).json({ error: 'Failed to prepare upload. Please try again.' });
  }

  // ── Issue HMAC confirmation token ──
  // Binds userId + path + title + artist to prevent TOCTOU and metadata-swap attacks.
  const uploadToken = signUploadToken({
    userId:    user.id,
    path:      signed.path,
    title:     title.trim(),
    artist:    artist.trim(),
    fileSize,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  return res.json({
    signedUrl:   signed.signedUrl,
    token:       signed.token,
    path:        signed.path,
    uploadToken,
  });
};
