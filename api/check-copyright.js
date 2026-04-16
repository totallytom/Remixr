/**
 * Copyright check API – blocks uploads of detected copyrighted content.
 * Checks: (1) metadata blocklist, (2) file hash blocklist, (3) optional ACRCloud.
 * Users with is_verified_artist (verified rights holders) skip all checks when
 * Authorization: Bearer <Supabase JWT> is sent.
 */

const { createClient } = require('@supabase/supabase-js');

const METADATA_BLOCKLIST = [
  // Format: "artist - title" (lowercase). Add known commercial tracks to block.
  'taylor swift - shake it off',
  'taylor swift - blank space',
  'taylor swift - anti-hero',
  'drake - one dance',
  'drake - hotline bling',
  'the weeknd - blinding lights',
  'the weeknd - starboy',
  'ed sheeran - shape of you',
  'ed sheeran - perfect',
  'justin bieber - sorry',
  'justin bieber - love yourself',
  'adele - hello',
  'adele - easy on me',
  'billie eilish - bad guy',
  'billie eilish - happier than ever',
  'post malone - sunflower',
  'post malone - rockstar',
  'ariana grande - thank u next',
  'ariana grande - positions',
  'bad bunny - dakiti',
  'bad bunny - monaco',
  'beyoncé - break my soul',
  'beyoncé - cuff it',
  'harry styles - as it was',
  'harry styles - watermelon sugar',
  'olivia rodrigo - drivers license',
  'olivia rodrigo - vampire',
  'doja cat - say so',
  'doja cat - kiss me more',
  'dua lipa - levitating',
  'dua lipa - don\'t start now',
  'bruno mars - uptown funk',
  'bruno mars - that\'s what i like',
  'rihanna - umbrella',
  'rihanna - work',
  'lady gaga - shallow',
  'lady gaga - poker face',
  'katy perry - roar',
  'katy perry - dark horse',
  'coldplay - viva la vida',
  'coldplay - yellow',
  'maroon 5 - sugar',
  'maroon 5 - moves like jagger',
  'imagine dragons - believer',
  'imagine dragons - radioactive',
  'twenty one pilots - stressed out',
  'twenty one pilots - heathens',
  'the chainsmokers - closer',
  'the chainsmokers - something just like this',
  'marshmello - alone',
  'marshmello - friends',
  'calvin harris - summer',
  'calvin harris - one kiss',
  'david guetta - titanium',
  'david guetta - without you',
  'avicii - wake me up',
  'avicii - levels',
  'zedd - clarity',
  'zedd - the middle',
  'martin garrix - animals',
  'martin garrix - in the name of love',
  'kygo - firestone',
  'kygo - higher love',
  'alan walker - faded',
  'alan walker - alone',
  'michael jackson - thriller',
  'michael jackson - billie jean',
  'queen - bohemian rhapsody',
  'queen - we will rock you',
  'eagles - hotel california',
  'eagles - take it easy',
  'fleetwood mac - dreams',
  'fleetwood mac - go your own way',
  'nirvana - smells like teen spirit',
  'nirvana - come as you are',
  'oasis - wonderwall',
  'oasis - don\'t look back in anger',
  'u2 - with or without you',
  'u2 - beautiful day',
  'ac/dc - back in black',
  'ac/dc - highway to hell',
  'led zeppelin - stairway to heaven',
  'led zeppelin - whole lotta love',
  'pink floyd - another brick in the wall',
  'pink floyd - wish you were here',
  'the beatles - hey jude',
  'the beatles - let it be',
  'rolling stones - satisfaction',
  'rolling stones - paint it black',
  'elvis presley - hound dog',
  'elvis presley - jailhouse rock',
  'frank sinatra - my way',
  'frank sinatra - fly me to the moon',
];

function normalizeForBlocklist(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getBlockedHashes() {
  try {
    const env = process.env.COPYRIGHT_BLOCKED_HASHES;
    if (env && typeof env === 'string') {
      const parsed = JSON.parse(env);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (_) {}
  return [];
}

async function checkMetadata(title, artist) {
  const key = `${normalizeForBlocklist(artist)} - ${normalizeForBlocklist(title)}`;
  if (METADATA_BLOCKLIST.includes(key)) return { blocked: true, reason: 'This track matches a known copyrighted recording and cannot be uploaded.' };
  // Also check artist-only blocklist for obvious impersonation of major artists
  const artistNorm = normalizeForBlocklist(artist);
  const blockedArtists = [
    'taylor swift', 'drake', 'the weeknd', 'ed sheeran', 'adele', 'billie eilish',
    'post malone', 'ariana grande', 'bad bunny', 'beyoncé', 'harry styles',
    'olivia rodrigo', 'doja cat', 'dua lipa', 'bruno mars', 'rihanna', 'lady gaga',
    'katy perry', 'coldplay', 'maroon 5', 'justin bieber', 'michael jackson',
    'queen', 'the beatles', 'rolling stones', 'elvis presley', 'frank sinatra',
    'nirvana', 'ac/dc', 'led zeppelin', 'pink floyd', 'eagles', 'fleetwood mac', 'u2', 'oasis',
  ];
  if (blockedArtists.includes(artistNorm)) {
    return { blocked: true, reason: 'Uploads under this artist name are restricted. Use your own artist name for original work.' };
  }
  return { blocked: false };
}

async function checkHash(hash) {
  const blocked = getBlockedHashes();
  if (blocked.includes((hash || '').toLowerCase())) {
    return { blocked: true, reason: 'This file matches a known copyrighted recording and cannot be uploaded.' };
  }
  return { blocked: false };
}

/** If user has is_verified_artist, skip all checks. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. */
async function isVerifiedArtist(authHeader) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !authHeader || typeof authHeader !== 'string') return false;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  try {
    const supabase = createClient(url, key);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user?.id) return false;
    const { data: row, error: rowError } = await supabase
      .from('users')
      .select('is_verified_artist')
      .eq('id', user.id)
      .maybeSingle();
    if (rowError || !row) return false;
    return row.is_verified_artist === true;
  } catch (_) {
    return false;
  }
}

// Optional: integrate ACRCloud by sending audio from client and calling their identify API.
// Set ACR_CLOUD_HOST, ACR_CLOUD_ACCESS_KEY, ACR_CLOUD_ACCESS_SECRET in env.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && (await isVerifiedArtist(authHeader))) {
      return res.status(200).json({ blocked: false });
    }

    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const { hash, title, artist } = body;

    const meta = await checkMetadata(String(title || ''), String(artist || ''));
    if (meta.blocked) {
      return res.status(200).json({ blocked: true, reason: meta.reason });
    }

    if (hash) {
      const hashResult = await checkHash(String(hash));
      if (hashResult.blocked) {
        return res.status(200).json({ blocked: true, reason: hashResult.reason });
      }
    }

    return res.status(200).json({ blocked: false });
  } catch (err) {
    console.error('check-copyright error:', err);
    const message = err && err.message ? err.message : 'Copyright check failed. Please try again.';
    return res.status(500).json({ error: message });
  }
};
