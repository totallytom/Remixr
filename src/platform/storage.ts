/**
 * Platform-agnostic storage abstraction.
 *
 * Web: backed by localStorage (default).
 * React Native: call setStorageAdapter() with an AsyncStorage-based adapter
 * before app initialisation, e.g.:
 *
 *   import AsyncStorage from '@react-native-async-storage/async-storage';
 *   setStorageAdapter({
 *     getItem:    (k) => AsyncStorage.getItem(k),
 *     setItem:    (k, v) => AsyncStorage.setItem(k, v),
 *     removeItem: (k) => AsyncStorage.removeItem(k),
 *   });
 */

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// ─── All storage keys used across the app ────────────────────────────────────

export const STORAGE_KEYS = {
  USER_STATUS:          'sypher_user_status',
  THEME:                'remix-theme',
  PROFILE_CACHE:        'sypher_cached_profile',
  SUPABASE_SESSION:     'supabase.auth.session',
  deletedChats:         (userId: string) => `deleted_chats_${userId}`,
  onboardingPending:    (userId: string) => `sypher_onboarding_pending_${userId}`,
} as const;

// ─── Web adapter (default) ────────────────────────────────────────────────────

const webAdapter: StorageAdapter = {
  async getItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  async setItem(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  },
  async removeItem(key) {
    try { localStorage.removeItem(key); } catch {}
  },
};

// ─── Active adapter (swap out for RN) ────────────────────────────────────────

let _adapter: StorageAdapter = webAdapter;

export function setStorageAdapter(adapter: StorageAdapter): void {
  _adapter = adapter;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const storage = {
  get(key: string): Promise<string | null> {
    return _adapter.getItem(key);
  },

  set(key: string, value: string): Promise<void> {
    return _adapter.setItem(key, value);
  },

  remove(key: string): Promise<void> {
    return _adapter.removeItem(key);
  },

  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await _adapter.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },

  setJSON<T>(key: string, value: T): Promise<void> {
    return _adapter.setItem(key, JSON.stringify(value));
  },
};
