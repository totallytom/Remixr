import { supabase } from './supabase';

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

async function parseJson(response: Response, fallback: string): Promise<any> {
  const text = await response.text();
  let payload: any = {};
  try { if (text) payload = JSON.parse(text); } catch {}
  if (!response.ok) throw new Error(payload.error ?? `${fallback} (${response.status})`);
  return payload;
}

const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  copyright_blocked: '',
  token_invalid:     'Upload session expired. Please try again.',
  token_expired:     'Upload session expired. Please try again.',
  file_not_found:    'Upload did not complete. Please try again.',
  file_invalid:      'The uploaded file appears to be invalid. Please try a different file.',
  forbidden:         'Access denied.',
};

function resolveUploadError(data: any): string {
  const code = data?.code as string | undefined;
  if (code === 'copyright_blocked') return data?.error || 'This track cannot be uploaded due to copyright restrictions.';
  if (code && UPLOAD_ERROR_MESSAGES[code]) return UPLOAD_ERROR_MESSAGES[code];
  return 'Upload failed. Please try again.';
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function requestUploadToken(body: {
  title: string;
  artist: string;
  filename: string;
  fileSize: number;
  fileType: string;
  sampleBase64: string;
}): Promise<{ signedUrl: string; token: string; path: string; uploadToken: string }> {
  const token = await getToken();
  const res = await fetch('/api/request-upload-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(resolveUploadError(data));
  return data;
}

export async function confirmUpload(payload: {
  uploadToken: string;
  album?: string;
  genre: string;
  duration: number;
  coverUrl: string;
  albumId?: string;
  previewStartSec?: number;
  previewDurationSec?: number;
  downloadPolicy?: 'off' | 'free' | 'followers' | 'paid';
  licenseType?: string;
  /** Remix Studio: source track ids in layer order. */
  remixSources?: string[];
}): Promise<{ id: string; status?: 'published' | 'pending_review' }> {
  const token = await getToken();
  const res = await fetch('/api/confirm-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(resolveUploadError(data));
  return data;
}

// ─── Stripe account ───────────────────────────────────────────────────────────

export interface StripeAccountStatus {
  connected: boolean;
  ready: boolean;
  requirementsDue: string[];
}

async function stripeAccountAction<T>(userId: string, action: string, fallbackError: string): Promise<T> {
  const token = await getToken();
  const response = await fetch('/api/create-stripe-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ userId, action }),
  });
  return parseJson(response, fallbackError);
}

/** Starts or resumes onboarding. url is null when the account is already ready. */
export function createStripeAccount(userId: string): Promise<{ url: string | null; ready: boolean }> {
  return stripeAccountAction(userId, 'onboard', 'Failed to start Stripe onboarding');
}

export function getStripeAccountStatus(userId: string): Promise<StripeAccountStatus> {
  return stripeAccountAction(userId, 'status', 'Could not check your payout account');
}

export function getStripeDashboardLink(userId: string): Promise<{ url: string }> {
  return stripeAccountAction(userId, 'dashboard', 'Could not open the Stripe dashboard');
}

// ─── Account ──────────────────────────────────────────────────────────────────

export async function deleteAccount(userId: string): Promise<void> {
  const token = await getToken();
  const response = await fetch('/api/delete-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ userId }),
  });
  const payload = await parseJson(response, 'Failed to delete account');
  if (!payload.success) throw new Error('Account deletion failed');
}

// ─── Storefront ───────────────────────────────────────────────────────────────

export async function createStorefrontCheckout(listingId: string): Promise<{ url: string; sessionId: string }> {
  const token = await getToken();
  const response = await fetch('/api/create-storefront-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ listingId }),
  });
  return parseJson(response, 'Checkout failed');
}

export async function getDownloadUrl(listingId: string): Promise<{ downloadUrl: string; filename: string; expiresAt: string }> {
  const token = await getToken();
  const response = await fetch(`/api/download-purchase?listing_id=${encodeURIComponent(listingId)}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return parseJson(response, 'Download failed');
}

/** Download a track under the artist's download setting (not a Storefront purchase). */
export async function getTrackDownloadUrl(trackId: string): Promise<{ downloadUrl: string; filename: string; expiresAt: string }> {
  const token = await getToken();
  const response = await fetch(`/api/download-purchase?track_id=${encodeURIComponent(trackId)}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return parseJson(response, 'Download failed');
}

// ─── Pro subscription ─────────────────────────────────────────────────────────

export async function createSubscriptionSession(body: {
  customerId?: string;
  plan: 'monthly' | 'yearly';
  userId?: string;
  email?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url?: string; error?: string }> {
  const token = await getToken();
  const res = await fetch('/api/create-subscription-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error('Checkout failed. Please try again.'); }
}

export async function createPortalSession(returnUrl: string): Promise<{ url: string }> {
  const token = await getToken();
  const response = await fetch('/api/create-portal-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ returnUrl }),
  });
  return parseJson(response, 'Failed to open billing portal');
}

export async function activateSubscription(sessionId: string): Promise<void> {
  const token = await getToken();
  const response = await fetch('/api/activate-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ sessionId }),
  });
  await parseJson(response, 'Failed to activate subscription');
}

export async function cancelProSubscription(subscriptionId: string): Promise<{ currentPeriodEnd: Date }> {
  const token = await getToken();
  const response = await fetch('/api/cancel-pro-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ subscriptionId }),
  });
  const data = await parseJson(response, 'Failed to cancel subscription');
  return { currentPeriodEnd: new Date(data.current_period_end * 1000) };
}
