const HTML_TAG_RE = /<[^>]*>/g;
const NULL_BYTE_RE = /\0/g;

/** Strip HTML tags and null bytes, trim whitespace, enforce max length. */
export function sanitizeText(str: unknown, maxLength: number): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(NULL_BYTE_RE, '')
    .replace(HTML_TAG_RE, '')
    .trim()
    .slice(0, maxLength);
}

/** Return true only for http(s) URLs — rejects javascript:, data:, etc. */
export function isSafeUrl(str: string): boolean {
  if (!str || str.length > 2048) return false;
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
