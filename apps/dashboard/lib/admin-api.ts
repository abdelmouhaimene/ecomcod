import {
  AdminRole,
  type AdminLoginPayload,
  type AdminLoginResponse,
  type ApiErrorResponse,
  type ChangeAdminPasswordPayload,
  type CreateAdminPayload,
  type MessageResponse,
  type PublicAdmin,
} from '@repo/types';

/** Future dashboard screens should use these exact role values, not local copies. */
export { AdminRole };

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002').replace(/\/+$/, '');

export class AdminApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

interface AdminFetchOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
}

/** Sends the `admin_session` cookie and reads the shared error/response shapes. */
async function adminFetch<T>(path: string, options: AdminFetchOptions = {}): Promise<T> {
  const { body, method = 'GET' } = options;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Request failed with HTTP ${response.status}`;
    try {
      const error = (await response.json()) as Partial<ApiErrorResponse>;
      if (typeof error.message === 'string') message = error.message;
    } catch {
      // Non-JSON error page (proxy, crash, ...): keep the HTTP status message.
    }
    throw new AdminApiError(response.status, message);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const adminApi = {
  login: (payload: AdminLoginPayload) =>
    adminFetch<AdminLoginResponse>('/v1/admin/auth/login', { method: 'POST', body: payload }),
  me: () => adminFetch<PublicAdmin>('/v1/admin/auth/me'),
  list: () => adminFetch<PublicAdmin[]>('/v1/admin/admins'),
  create: (payload: CreateAdminPayload) =>
    adminFetch<PublicAdmin>('/v1/admin/admins', { method: 'POST', body: payload }),
  remove: (id: string) =>
    adminFetch<void>(`/v1/admin/admins/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  changePassword: (payload: ChangeAdminPasswordPayload) =>
    adminFetch<MessageResponse>('/v1/admin/auth/change-password', {
      method: 'POST',
      body: payload,
    }),
  logout: () => adminFetch<void>('/v1/admin/auth/logout', { method: 'POST' }),
};
