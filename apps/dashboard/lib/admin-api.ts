import {
  AdminRole,
  type AdminLoginPayload,
  type AdminLoginResponse,
  type ApiErrorResponse,
  type CategoryPayload,
  type ChangeAdminPasswordPayload,
  type CreateAdminCommentPayload,
  type CreateAdminPayload,
  type FamilyPayload,
  type GalleryPhotoPayload,
  type GalleryState,
  type GalleryStatusPayload,
  type MessageResponse,
  type OfferPayload,
  type OrderPayload,
  type ProductPayload,
  type PublicAdmin,
  type PublicCategory,
  type PublicComment,
  type PublicFamily,
  type PublicGalleryPhoto,
  type PublicOffer,
  type PublicOrder,
  type PublicProduct,
  type PublicStoreInfo,
  type PublicStockAvailability,
  type PublicStockEntry,
  type PublicSupplier,
  type PublicUser,
  type StockEntryFilter,
  type StockEntryPayload,
  type StoreInfoPayload,
  type SupplierPayload,
  type UploadImageResponse,
} from '@repo/types';

/** Future dashboard screens should use these exact role values, not local copies. */
export { AdminRole };

/** Catalog contracts used by the dashboard editors. */
export type {
  CategoryPayload,
  CreateAdminCommentPayload,
  PublicComment,
  GalleryPhotoPayload,
  GalleryState,
  GalleryStatusPayload,
  PublicGalleryPhoto,
  FamilyPayload,
  OfferPayload,
  OrderPayload,
  ProductImagePayload,
  ProductPayload,
  ProductVariantPayload,
  PublicCategory,
  PublicFamily,
  PublicOffer,
  PublicOrder,
  PublicProduct,
  PublicProductImage,
  PublicProductSku,
  PublicProductVariant,
  PublicStoreInfo,
  PublicStockAvailability,
  PublicStockEntry,
  PublicSupplier,
  StockEntryFilter,
  StockEntryPayload,
  StoreInfoPayload,
  SupplierPayload,
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

  // Families (separate from categories; system/manager may mutate).
  listFamilies: () => adminFetch<PublicFamily[]>('/v1/admin/families'),
  getFamily: (id: string) =>
    adminFetch<PublicFamily>(`/v1/admin/families/${encodeURIComponent(id)}`),
  createFamily: (payload: FamilyPayload) =>
    adminFetch<PublicFamily>('/v1/admin/families', { method: 'POST', body: payload }),
  updateFamily: (id: string, payload: FamilyPayload) =>
    adminFetch<PublicFamily>(`/v1/admin/families/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: payload,
    }),
  removeFamily: (id: string) =>
    adminFetch<void>(`/v1/admin/families/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Offers (single-product and pack promotions; system/manager may mutate).
  listOffers: () => adminFetch<PublicOffer[]>('/v1/admin/offers'),
  getOffer: (id: string) => adminFetch<PublicOffer>(`/v1/admin/offers/${encodeURIComponent(id)}`),
  createOffer: (payload: OfferPayload) =>
    adminFetch<PublicOffer>('/v1/admin/offers', { method: 'POST', body: payload }),
  updateOffer: (id: string, payload: OfferPayload) =>
    adminFetch<PublicOffer>(`/v1/admin/offers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: payload,
    }),
  removeOffer: (id: string) =>
    adminFetch<void>(`/v1/admin/offers/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Testimonials (all active admins may read; system/manager may create/delete).
  listComments: () => adminFetch<PublicComment[]>('/v1/admin/comments'),
  createComment: (payload: CreateAdminCommentPayload) =>
    adminFetch<PublicComment>('/v1/admin/comments', { method: 'POST', body: payload }),
  removeComment: (id: string) =>
    adminFetch<void>(`/v1/admin/comments/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Gallery (all active admins may read; system/manager may mutate).
  getGallery: () => adminFetch<GalleryState>('/v1/admin/gallery'),
  setGalleryStatus: (payload: GalleryStatusPayload) =>
    adminFetch<GalleryState>('/v1/admin/gallery/status', { method: 'PUT', body: payload }),
  createGalleryPhoto: (payload: GalleryPhotoPayload) =>
    adminFetch<PublicGalleryPhoto>('/v1/admin/gallery/photos', {
      method: 'POST',
      body: payload,
    }),
  removeGalleryPhoto: (id: string) =>
    adminFetch<void>(`/v1/admin/gallery/photos/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Store page (all active admins may read; system/manager may edit).
  getStore: () => adminFetch<PublicStoreInfo>('/v1/admin/store'),
  updateStore: (payload: StoreInfoPayload) =>
    adminFetch<PublicStoreInfo>('/v1/admin/store', { method: 'PUT', body: payload }),

  // Suppliers (all active admins may read; system/manager may mutate).
  listSuppliers: () => adminFetch<PublicSupplier[]>('/v1/admin/suppliers'),
  createSupplier: (payload: SupplierPayload) =>
    adminFetch<PublicSupplier>('/v1/admin/suppliers', { method: 'POST', body: payload }),
  updateSupplier: (id: string, payload: SupplierPayload) =>
    adminFetch<PublicSupplier>(`/v1/admin/suppliers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: payload,
    }),
  removeSupplier: (id: string) =>
    adminFetch<void>(`/v1/admin/suppliers/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Stock entries (all active admins may read; system/manager may create; system may delete).
  listStockEntries: (filter: StockEntryFilter = {}) => {
    const params = new URLSearchParams();
    if (filter.month !== undefined) params.set('month', String(filter.month));
    if (filter.year !== undefined) params.set('year', String(filter.year));
    if (filter.productId) params.set('productId', filter.productId);
    if (filter.skuId) params.set('skuId', filter.skuId);
    if (filter.supplierId) params.set('supplierId', filter.supplierId);
    const query = params.toString();
    return adminFetch<PublicStockEntry[]>(
      `/v1/admin/stock-entries${query ? `?${query}` : ''}`,
    );
  },
  createStockEntry: (payload: StockEntryPayload) =>
    adminFetch<PublicStockEntry>('/v1/admin/stock-entries', { method: 'POST', body: payload }),
  removeStockEntry: (id: string) =>
    adminFetch<void>(`/v1/admin/stock-entries/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  /** Live per-SKU stock snapshot used by stock and POS pickers. */
  listStockAvailability: () =>
    adminFetch<PublicStockAvailability[]>('/v1/admin/stock/availability'),

  // POS orders (readable by all active admins; system/manager may create).
  listPosOrders: () => adminFetch<PublicOrder[]>('/v1/admin/pos/orders'),
  getPosOrder: (id: string) =>
    adminFetch<PublicOrder>(`/v1/admin/pos/orders/${encodeURIComponent(id)}`),
  createPosOrder: (payload: OrderPayload) =>
    adminFetch<PublicOrder>('/v1/admin/pos/orders', { method: 'POST', body: payload }),

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
