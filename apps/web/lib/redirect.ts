/**
 * Only same-origin, relative paths are allowed as post-login destinations.
 * Mirrors the API-side check so `?redirect=//evil.example` can never be used
 * to send the browser somewhere else.
 */
export function safeRedirectPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}
