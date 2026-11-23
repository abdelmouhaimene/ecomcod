import type { PublicProduct, PublicProductSku } from '@repo/types';
import { API_URL } from './api';

/**
 * Product image URLs are stored either as absolute links or as API-relative
 * upload paths. Keep the resolution rule in one browser-safe helper.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

export function formatPrice(value: number, currency = 'DZD'): string {
  return `${currency} ${value.toFixed(2)}`;
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getAvailableSkus(product: PublicProduct): PublicProductSku[] {
  return product.skus.filter((sku) => sku.isActive && sku.stockQuantity > 0);
}

/** Prefer an in-stock SKU, but fall back to the first SKU for display only. */
export function getPrimarySku(product: PublicProduct): PublicProductSku | undefined {
  return getAvailableSkus(product)[0] ?? product.skus[0];
}

export function getPrimaryImageUrl(
  product: PublicProduct,
  sku?: PublicProductSku | null
): string {
  const mainImage = product.images.find((image) => image.isMain) ?? product.images[0];
  return resolveMediaUrl(sku?.imageUrl || mainImage?.url);
}

export function getSalesCount(product: PublicProduct): number {
  return product.fakeSolds + product.realSolds;
}

/**
 * `fakeReviews` and `realReviews` are both 0–5 ratings in the shared contract.
 * Average the non-zero values so the UI always shows a value out of five.
 */
export function getRating(product: PublicProduct): number | null {
  const ratings = [product.fakeReviews, product.realReviews].filter(
    (rating) => rating > 0
  );
  if (ratings.length === 0) return null;
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return Math.min(5, Math.round((total / ratings.length) * 10) / 10);
}
