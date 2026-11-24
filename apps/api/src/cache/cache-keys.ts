import type { ProductListQuery } from '@repo/types';

/** Namespace prefixes keep data cache keys separate from auth/session keys. */
export const CACHE_PREFIXES = {
    offersActive: 'cache:offers:active:v1',
    catalog: 'cache:catalog:products:v1',
    product: 'cache:product:v1:',
    families: 'cache:families:v1',
    stockAvailability: 'cache:stock:availability:v1',
    sku: 'cache:sku:v1:',
} as const;

export const LOCK_PREFIXES = {
    checkout: 'lock:checkout:v1:',
} as const;

export const CACHE_TTLS_SECONDS = {
    catalog: 60,
    product: 60,
    families: 300,
    offers: 30,
    stock: 15,
} as const;

/** Query-specific catalog key; always starts with the catalog prefix so one
 * prefix invalidation clears every filtered page and the legacy list key. */
export const catalogListKey = (query: ProductListQuery): string => {
    const page = query.page ?? 1;
    const limit = query.limit ?? 9;
    const q = query.q ?? '';
    const categoryId = query.categoryId ?? '';
    const familyId = query.familyId ?? '';
    return `${CACHE_PREFIXES.catalog}:page=${page}|limit=${limit}|q=${encodeURIComponent(q)}|category=${categoryId}|family=${familyId}`;
};

export const productKey = (id: string): string => `${CACHE_PREFIXES.product}${id}`;
export const skuKey = (id: string): string => `${CACHE_PREFIXES.sku}${id}`;
export const checkoutKey = (scope: string): string => `${LOCK_PREFIXES.checkout}${scope}`;
