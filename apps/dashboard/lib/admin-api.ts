import {
  AdminRole,
  type AdminLoginPayload,
  type AdminLoginResponse,
  type ApiErrorResponse,
  type CategoryPayload,
  type ChangeAdminPasswordPayload,
  type CreateAdminPayload,
  type MessageResponse,
  type ProductPayload,
  type PublicAdmin,
  type PublicCategory,
  type PublicProduct,
  type PublicUser,
  type UploadImageResponse,
} from '@repo/types';

/** Future dashboard screens should use these exact role values, not local copies. */
export { AdminRole };

/** Catalog contracts used by the dashboard editors. */
export type {
  CategoryPayload,
  ProductImagePayload,
  ProductPayload,
  ProductVariantPayload,
  PublicCategory,
  PublicProduct,
  PublicProductImage,
  PublicProductVariant,
  UploadImageResponse,
} from '@repo/types';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002').replace(/\/+$/, '');

/**
 * Uploaded images are served by the API at `/uploads/<file>`, not by the
 * dashboard. Resolve relative media URLs against the API origin so thumbnails
 * work when both apps run on different hosts/ports and stay same-origin safe
 * when `NEXT_PUBLIC_API_URL` is empty in production.
 */
export function resolveMediaUrl(url: string): string {
  if (url.startsWith('//') || /^https?:\/\//i.test(url) || url.startsWith('data:')) {
    return url;
  }
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export class AdminApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

interface AdminFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Send the body as multipart/form-data; no JSON content-type is added. */
  formData?: boolean;
}

/** Sends the `admin_session` cookie and reads the shared error/response shapes. */
async function adminFetch<T>(path: string, options: AdminFetchOptions = {}): Promise<T> {
  const { body, method = 'GET' } = options;
  const useFormData =
    options.formData ?? (typeof FormData !== 'undefined' && body instanceof FormData);
  const hasBody = body !== undefined;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers:
      hasBody && !useFormData ? { 'content-type': 'application/json' } : undefined,
    body: hasBody ? (useFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
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
  /** Any active admin may read the storefront's public customer records. */
  listUsers: () => adminFetch<PublicUser[]>('/v1/users'),
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

  // Categories (all active admins may read; system/manager may mutate).
  listCategories: () => adminFetch<PublicCategory[]>('/v1/admin/categories'),
  getCategory: (id: string) =>
    adminFetch<PublicCategory>(`/v1/admin/categories/${encodeURIComponent(id)}`),
  createCategory: (payload: CategoryPayload) =>
    adminFetch<PublicCategory>('/v1/admin/categories', { method: 'POST', body: payload }),
  updateCategory: (id: string, payload: CategoryPayload) =>
    adminFetch<PublicCategory>(`/v1/admin/categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: payload,
    }),
  removeCategory: (id: string) =>
    adminFetch<void>(`/v1/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Products (all active admins may read; system/manager may mutate).
  listProducts: () => adminFetch<PublicProduct[]>('/v1/admin/products'),
  getProduct: (id: string) =>
    adminFetch<PublicProduct>(`/v1/admin/products/${encodeURIComponent(id)}`),
  createProduct: (payload: ProductPayload) =>
    adminFetch<PublicProduct>('/v1/admin/products', { method: 'POST', body: payload }),
  updateProduct: (id: string, payload: ProductPayload) =>
    adminFetch<PublicProduct>(`/v1/admin/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: payload,
    }),
  removeProduct: (id: string) =>
    adminFetch<void>(`/v1/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return adminFetch<UploadImageResponse>('/v1/admin/uploads', {
      method: 'POST',
      body: formData,
      formData: true,
    });
  },
};
