// Shared input validation helpers for all API endpoints.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}$/;
// Stripe IDs: one or more lowercase letters, underscore, then alphanumeric/underscore chars
const STRIPE_ID_RE = /^[a-z]+_[a-zA-Z0-9_]{1,220}$/;

function isUUID(str) {
  return typeof str === 'string' && UUID_RE.test(str);
}

function isEmail(str) {
  return typeof str === 'string' && str.length <= 254 && EMAIL_RE.test(str);
}

function isStripeId(str) {
  return typeof str === 'string' && str.length <= 255 && STRIPE_ID_RE.test(str);
}

// Only accept http(s) URLs. If appOrigin is provided, also enforce same hostname.
function isSafeUrl(str, appOrigin) {
  if (!str || typeof str !== 'string' || str.length > 2048) return false;
  try {
    const u = new URL(str);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (appOrigin) {
      const origin = new URL(appOrigin);
      return u.hostname === origin.hostname;
    }
    return true;
  } catch {
    return false;
  }
}

// Strip null bytes and enforce a maximum length.
function truncate(str, max) {
  if (typeof str !== 'string') return '';
  return str.replace(/\0/g, '').slice(0, max);
}

// Resolve the app's own origin from env vars only — never from request headers,
// which can be spoofed via x-forwarded-host.
function resolveAppUrl() {
  const raw = process.env.APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || 'https://re-mixed.net';
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
}

module.exports = { isUUID, isEmail, isStripeId, isSafeUrl, truncate, resolveAppUrl };
