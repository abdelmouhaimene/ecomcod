import type { PublicCategory } from '../category/categoryType.js';

/**
 * Catalog contracts shared by the admin API and the dashboard.
 *
 * `key` is a client-stable identifier used while editing: it is the database
 * id for existing rows and a temporary id for rows added in the same form.
 * `TDate` follows the other domains: Date inside Nest, ISO strings on the wire.
 */
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

export interface PublicProductVariant<TDate = string> {
    id: string;
    key: string;
    name: string;
    value: string;
    price: number;
    imageId: string;
    /** Matches the image's `key`, so the editor can preselect it. */
    imageKey: string;
    imageUrl: string;
    createdAt: TDate;
}

export interface ProductVariantPayload {
    key?: string;
    name: string;
    value: string;
    price: number;
    /** Key of an image in the same product payload. */
    imageKey: string;
}

export interface PublicProduct<TDate = string> {
    id: string;
    ref: string;
    name: string;
    subtitle: string | null;
    description: string | null;
    price: number;
    oldPrice: number | null;
    /** Ratings from 0 to 5 with at most one decimal place. */
    fakeReviews: number;
    realReviews: number;
    /** Sales counters; `realSolds` is recorded from sales, not by an admin. */
    fakeSolds: number;
    realSolds: number;
    categories: PublicCategory<TDate>[];
    images: PublicProductImage<TDate>[];
    variants: PublicProductVariant<TDate>[];
    createdAt: TDate;
    updatedAt: TDate;
}

/** Full replacement payload used by both create and update. */
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
    images: ProductImagePayload[];
    variants: ProductVariantPayload[];
}

export interface UploadImageResponse {
    url: string;
}
