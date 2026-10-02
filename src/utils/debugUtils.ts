import { useEffect } from 'react';

const hideUUIDs = (text: string): string => {
  // UUID pattern: 8-4-4-4-12 hexadecimal characters
  const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
  return text.replace(uuidPattern, '***');
};

/**
 * Safely logs messages without exposing UUIDs
 * @param message - The message to log
 * @param data - Optional data to log
 */
export const safeLog = (message: string, data?: any): void => {
  const safeMessage = hideUUIDs(message);
  if (data) {
    const safeData = JSON.parse(hideUUIDs(JSON.stringify(data)));
    console.log(safeMessage, safeData);
  } else {
    console.log(safeMessage);
  }
};

/**
 * Creates a display name from a UUID for UI purposes
 * @param uuid - The UUID to convert
 * @returns A short display name
 */
export const createDisplayName = (uuid: string): string => {
  if (!uuid || uuid.length < 8) return 'Unknown';
  return uuid.substring(0, 8).toUpperCase();
};

/**
 * Masks UUIDs in URLs for display purposes
 * @param url - The URL that might contain UUIDs
 * @returns The URL with UUIDs masked
 */
const maskUrlUUIDs = (url: string): string => {
  const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
  return url.replace(uuidPattern, '***');
};

/**
 * Creates a user-friendly playlist name from UUID
 * @param uuid - The playlist UUID
 * @returns A friendly display name
 */
export const createPlaylistDisplayName = (uuid: string): string => {
  if (!uuid || uuid.length < 8) return 'Playlist';
  const shortId = uuid.substring(0, 8).toUpperCase();
  return `Playlist ${shortId}`;
}; 

/**
 * Custom hook to mask UUIDs in browser title and URL display
 * @param title - The page title
 * @param url - The current URL
 */
export const useUUIDMasking = (title: string, url?: string) => {
  useEffect(() => {
    // Mask UUIDs in the page title
    const maskedTitle = hideUUIDs(title);
    document.title = maskedTitle;
    
    // Mask UUIDs in the browser's address bar display (if possible)
    if (url) {
      const maskedUrl = maskUrlUUIDs(url);
      // Note: We can't actually change the URL without navigation,
      // but we can update the browser's history entry
      window.history.replaceState(null, maskedTitle, window.location.pathname);
    }
  }, [title, url]);
}; 