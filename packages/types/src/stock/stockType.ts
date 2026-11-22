/**
 * Stock contracts shared by the admin API and the dashboard.
 *
 * A stock entry ("bon d'entrée") is the only admin way to increase SKU stock.
 * Each item is product-level: the user sets one buying price and one total
 * quantity for the product, then distributes that quantity across the
 * product's generated combinations. Every change is recorded as a
 * `stock_movements` row and the SKU plus product aggregate stock are recomputed
 * from those movements inside one PostgreSQL transaction. Totals are always
 * computed by the API. `TDate` follows the other domains: Date inside Nest,
 * ISO strings on the wire.
 */

/** A managed supplier; stock entries reference one by id. */
export interface PublicSupplier<TDate = string> {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    description: string | null;
    createdAt: TDate;
    updatedAt: TDate;
}

export interface SupplierPayload {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    description?: string | null;
}

/** Quantity assigned to one generated combination of a product. */
export interface StockEntryCombinationPayload {
    skuId: string;
    /** Non-negative integer. Zero keeps untouched combinations visible. */
    quantity: number;
}

/**
 * One product line on a stock entry. All combinations of that product share
 * `buyingPrice`; `sum(combinations.quantity)` must equal `totalQuantity`.
 */
export interface StockEntryItemPayload {
    productId: string;
    /** Non-negative amount with at most two decimals. */
    buyingPrice: number;
    /** Positive integer. */
    totalQuantity: number;
    combinations: StockEntryCombinationPayload[];
}

/** Persisted combination quantity with denormalised catalog fields. */
export interface PublicStockEntryCombination<TDate = string> {
    id: string;
    skuId: string;
    sku: string;
    skuLabel: string;
    quantity: number;
    createdAt: TDate;
}

/** One product-level line on a stock entry document. */
export interface PublicStockEntryItem<TDate = string> {
    id: string;
    productId: string;
    /** Denormalised catalog fields so the document stays readable. */
    productRef: string;
    productName: string;
    buyingPrice: number;
    totalQuantity: number;
    /** `totalQuantity * buyingPrice`, computed by the API. */
    lineTotal: number;
    combinations: PublicStockEntryCombination<TDate>[];
    createdAt: TDate;
}

export interface PublicStockEntry<TDate = string> {
    id: string;
    /** Calendar date of the document in `YYYY-MM-DD` form. */
    date: string;
    supplierId: string;
    supplierName: string;
    /** Admin who created the document. */
    adminId: string;
    adminUsername: string;
    /** Sum of every product line's `lineTotal`, computed by the API. */
    total: number;
    items: PublicStockEntryItem<TDate>[];
    createdAt: TDate;
    updatedAt: TDate;
}

/** Payload used to create a stock entry. */
export interface StockEntryPayload {
    date: string;
    supplierId: string;
    items: StockEntryItemPayload[];
}

/** Optional query parameters for listing stock entries. */
export interface StockEntryFilter {
    /** Calendar month, 1-12. */
    month?: number;
    /** Four-digit year. */
    year?: number;
    productId?: string;
    supplierId?: string;
    skuId?: string;
}

/** Read-only stock snapshot used by CMS, POS and the storefront. */
export interface PublicStockAvailability<TDate = string> {
    skuId: string;
    productId: string;
    sku: string;
    label: string;
    productRef: string;
    productName: string;
    stockQuantity: number;
    updatedAt: TDate;
}
