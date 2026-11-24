import type { PublicCategory } from '../category/categoryType.js';
import type { PublicFamily } from '../family/familyType.js';

/**
 * Catalog contracts shared by the admin API and the dashboard.
 *
 * `key` is a client-stable identifier used while editing: it is the database
 * id for existing rows and a temporary id for rows added in the same form.
 * `TDate` follows the other domains: Date inside Nest, ISO strings on the wire.
 *
 * A product defines variants (for example Color, Size) and each variant owns
 * its allowed values (for example Black, White / M, L). Variants and values
 * never carry a price. Every generated SKU inherits `Product.price`; a
 * different price always means a different product.
 */
export const VARIANT_TYPES = ['COLOR', 'SIZE_TEXT', 'SIZE_NUM', 'DESIGN', 'OTHER'] as const;
export type VariantType = (typeof VARIANT_TYPES)[number];

export const SIZE_TEXT_VALUES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
export type SizeTextValue = (typeof SIZE_TEXT_VALUES)[number];

export interface PublicProductImage<TDate = string> {
    id: string;
    key: string;
    url: string;
    isMain: boolean;
    position: number;
    createdAt: TDate;
}

export interface ProductImagePayload {
    key: string;
    url: string;
    isMain: boolean;
    position: number;
}

/** One allowed value inside a product variant. */
export interface PublicProductVariantValue<TDate = string> {
    id: string;
    key: string;
    value: string;
    /** Required for `COLOR`; `null` for every other variant type. */
    hexColor: string | null;
    /** `null` when no image was chosen for this value. */
    imageId: string | null;
    /** Matches the image's `key`, so the editor can preselect it; `null` for no image. */
    imageKey: string | null;
    imageUrl: string;
    position: number;
    createdAt: TDate;
}

/** A product-scoped variant dimension with its allowed values. */
export interface PublicProductVariant<TDate = string> {
    id: string;
    key: string;
    /** Dimension label. For `OTHER` this is the user-created type name. */
    name: string;
    variantType: VariantType;
    values: PublicProductVariantValue<TDate>[];
    createdAt: TDate;
}

export interface ProductVariantValuePayload {
    key?: string;
    value: string;
    hexColor?: string | null;
    /** Optional key of an image in the same product payload; omit or `null` for no image. */
    imageKey?: string | null;
}

export interface ProductVariantPayload {
    key?: string;
    name: string;
    variantType: VariantType;
    values: ProductVariantValuePayload[];
}

/** A sellable single- or multi-dimension combination. */
export interface PublicProductSku<TDate = string> {
    id: string;
    productId: string;
    sku: string;
    /** Canonical, sorted dimension signature; unique per product. */
    combinationKey: string;
    /** Human-readable combination, e.g. `Red / M`. */
    label: string;
    imageId: string | null;
    imageUrl: string;
    stockQuantity: number;
    /** Weighted average purchase price; server-owned. */
    PMP: number;
    isActive: boolean;
    /** Ids of the selected `PublicProductVariantValue` rows. */
    variantValueIds: string[];
    createdAt: TDate;
    updatedAt: TDate;
}

/** Query-string filters accepted by the public paginated catalog. */
export interface ProductListQuery {
    /** 1-based page number. */
    page?: number;
    /** Products per page (9 for the storefront). */
    limit?: number;
    /** Case-insensitive search over product and category/family names. */
    q?: string;
    categoryId?: string;
    familyId?: string;
}

/** Envelope returned by `GET /v1/products`. */
export interface PaginatedProducts<TDate = string> {
    items: PublicProduct<TDate>[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface PublicProduct<TDate = string> {
    id: string;
    ref: string;
    name: string;
    subtitle: string | null;
    description: string | null;
    /** Authoritative base price inherited by every SKU. */
    price: number;
    oldPrice: number | null;
    /** Ratings from 0 to 5 with at most one decimal place. */
    fakeReviews: number;
    realReviews: number;
    /** Sales counters; `realSolds` is recorded from sales, not by an admin. */
    fakeSolds: number;
    realSolds: number;
    /** Aggregate stock across all active SKUs; maintained by stock movements. */
    quantity: number;
    /** Weighted average purchase price (PMP/WAP); maintained by stock movements. */
    PMP: number;
    categories: PublicCategory<TDate>[];
    families: PublicFamily<TDate>[];
    images: PublicProductImage<TDate>[];
    variants: PublicProductVariant<TDate>[];
    skus: PublicProductSku<TDate>[];
    createdAt: TDate;
    updatedAt: TDate;
}

/** Image processing profile requested by the dashboard uploader. */
export type UploadImageKind = 'product' | 'client' | 'gallery' | 'category-icon' | 'logo';

export interface UploadImageResponse {
    url: string;
}

export interface ProductPayload {
    ref: string;
    name: string;
    subtitle?: string | null;
    description?: string | null;
    price: number;
    oldPrice?: number | null;
    /** Ratings from 0 to 5 with at most one decimal place. */
    fakeReviews: number;
    realReviews: number;
    /** `realSolds` is server-owned; the dashboard preserves its value. */
    fakeSolds: number;
    realSolds: number;
    categoryIds: string[];
    /** Optional so existing category-only payloads keep working. */
    familyIds?: string[];
    images: ProductImagePayload[];
    variants: ProductVariantPayload[];
}
