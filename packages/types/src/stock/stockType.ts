/**
 * Stock contracts shared by the admin API and the dashboard.
 *
 * A stock entry ("bon d'entrée") is the only way admins change a product's
 * `quantity` and `PMP`. Totals are always computed by the API from the lines.
 * `TDate` follows the other domains: Date inside Nest, ISO strings on the wire.
 */

/** A managed supplier; stock entries reference one by id. */
export interface PublicSupplier<TDate = string> {
    id: string;
    name: string;
    createdAt: TDate;
    updatedAt: TDate;
}

export interface SupplierPayload {
    name: string;
}

/** One product line on a stock entry. */
export interface PublicStockEntryItem<TDate = string> {
    id: string;
    productId: string;
    /** Denormalised catalog fields so the document stays readable. */
    productRef: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    /** `quantity * unitPrice`, computed by the API. */
    lineTotal: number;
    createdAt: TDate;
}

export interface StockEntryItemPayload {
    productId: string;
    /** Positive integer. */
    quantity: number;
    /** Non-negative amount with at most two decimals. */
    unitPrice: number;
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
    /** Sum of every line's `lineTotal`, computed by the API. */
    total: number;
    items: PublicStockEntryItem<TDate>[];
    createdAt: TDate;
    updatedAt: TDate;
}

/** Full replacement payload used to create a stock entry. */
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
}
