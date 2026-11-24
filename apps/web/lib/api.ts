import type {
  ApiErrorResponse,
  CreateCommentPayload,
  GalleryState,
  OrderPayload,
  PaginatedProducts,
  ProductListQuery,
  PublicComment,
  PublicCategory,
  PublicFamily,
  PublicOffer,
  PublicOrder,
  PublicProduct,
  PublicStoreInfo,
} from '@repo/types';

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

/** Builds the URL query string that is the source of truth for the catalog. */
function productQuery(query: ProductListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.q) params.set('q', query.q);
  if (query.categoryId) params.set('categoryId', query.categoryId);
  if (query.familyId) params.set('familyId', query.familyId);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

/** Typed storefront calls. All paths are relative to `API_URL`. */
export const catalogApi = {
  listProducts: (query: ProductListQuery = {}) =>
    apiFetch<PaginatedProducts>(`/v1/products${productQuery(query)}`),
  /** For internal consumers that need the whole catalog, not a visible page. */
  listAllProducts: async (): Promise<PublicProduct[]> => {
    const first = await catalogApi.listProducts({ page: 1, limit: 1000 });
    if (first.totalPages <= 1) return first.items;
    const remaining = await Promise.all(
      Array.from({ length: first.totalPages - 1 }, (_, index) =>
        catalogApi.listProducts({ page: index + 2, limit: 1000 }),
      ),
    );
    return [...first.items, ...remaining.flatMap((page) => page.items)];
  },
  listCategories: () => apiFetch<PublicCategory[]>('/v1/categories'),
  getProduct: (id: string) =>
    apiFetch<PublicProduct>(`/v1/products/${encodeURIComponent(id)}`),
  listActiveOffers: () => apiFetch<PublicOffer[]>('/v1/offers/active'),
  getOffer: (id: string) =>
    apiFetch<PublicOffer>(`/v1/offers/${encodeURIComponent(id)}`),
  listComments: () => apiFetch<PublicComment[]>('/v1/comments'),
  getGallery: () => apiFetch<GalleryState>('/v1/gallery'),
  getStore: () => apiFetch<PublicStoreInfo>('/v1/store'),
  createComment: (payload: CreateCommentPayload) =>
    apiFetch<PublicComment>('/v1/comments', { method: 'POST', body: payload }),
  listFamilies: () => apiFetch<PublicFamily[]>('/v1/families'),
  createOrder: (payload: OrderPayload) =>
    apiFetch<PublicOrder>('/v1/orders', { method: 'POST', body: payload }),
  getOrder: (id: string) =>
    apiFetch<PublicOrder>(`/v1/orders/${encodeURIComponent(id)}`),
};
