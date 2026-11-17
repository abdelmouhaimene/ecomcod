import type { ApiErrorResponse } from '@repo/types';

/**
 * The browser talks to the Nest API directly. Cookies (including the httpOnly
 * session cookie) are only sent when `credentials: 'include'` is set, which is
 * why every request goes through this helper instead of a bare `fetch`.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002').replace(
  /\/+$/,
  ''
);

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body' | 'credentials'> {
  /** Plain JSON body; serialized here so callers never forget the headers. */
  body?: unknown;
}

/** Reads the shared `ApiErrorResponse.message` (or Nest's string[]) safely. */
function messageFromBody(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;

  const message: unknown = (body as Partial<ApiErrorResponse>).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) {
    const parts = message.filter((part): part is string => typeof part === 'string');
    if (parts.length > 0) return parts.join(' ');
  }
  return null;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, ...init } = options;
  const requestHeaders = new Headers(headers);
  if (body !== undefined && !requestHeaders.has('content-type')) {
    requestHeaders.set('content-type', 'application/json');
  }

  // Network failures reject with a TypeError, which callers treat as "API down".
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Request failed with HTTP ${response.status}`;
    try {
      message = messageFromBody(await response.json()) ?? message;
    } catch {
      // Non-JSON error page (proxy, crash, ...): keep the HTTP status message.
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
