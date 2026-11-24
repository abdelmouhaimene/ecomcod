/**
 * Customer and POS order contracts. The API calculates all prices from the
 * current product price and active offers; clients never submit unit prices.
 */
export const ORDER_SOURCES = ['WEB', 'POS'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const ORDER_STATUSES = ['COMPLETED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_ITEM_KINDS = ['REGULAR', 'SINGLE_FREE', 'PACK'] as const;
export type OrderItemKind = (typeof ORDER_ITEM_KINDS)[number];

export interface OrderItemPayload {
    skuId: string;
    quantity: number;
}

/**
 * Variant chosen by the client for one or more units of an offered product.
 * Sending several entries for the same product lets each unit have its own SKU.
 * Omitting `quantity` in a single entry keeps the legacy meaning: that SKU
 * covers every unit of the product in the offer.
 */
export interface AppliedOfferSelectionPayload {
    productId: string;
    skuId: string;
    quantity?: number;
}

export interface AppliedOfferPayload {
    offerId: string;
    times: number;
    /** Every unit of every offered product needs an explicit variant choice. */
    selections: AppliedOfferSelectionPayload[];
}

export interface OrderPayload {
    source: OrderSource;
    /** Regular paid units not already covered by an applied offer. */
    items: OrderItemPayload[];
    offers?: AppliedOfferPayload[];
    customerName?: string | null;
    customerEmail?: string | null;
    /** Normalized Algerian mobile number, e.g. `0555123456`. */
    customerPhone?: string | null;
    wilayaCode?: string | null;
    wilayaName?: string | null;
    communeCode?: string | null;
    communeName?: string | null;
    notes?: string | null;
    /** Base shipping cost before free-shipping offers; defaults to 0. */
    baseShippingCost?: number;
    taxAmount?: number;
}

export interface PublicOrderItem<TDate = string> {
    id: string;
    skuId: string;
    productId: string;
    sku: string;
    productName: string;
    quantity: number;
    /** Product base price snapshot at checkout; `0` for `SINGLE_FREE` units. */
    unitPrice: number;
    lineTotal: number;
    kind: OrderItemKind;
    offerId: string | null;
    offerName: string | null;
    createdAt: TDate;
}

export interface PublicOrder<TDate = string> {
    id: string;
    orderNumber: string;
    source: OrderSource;
    status: OrderStatus;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    wilayaCode: string | null;
    wilayaName: string | null;
    communeCode: string | null;
    communeName: string | null;
    notes: string | null;
    subtotal: number;
    /** Value of free units and pack savings, computed by the API. */
    discount: number;
    shippingCost: number;
    taxAmount: number;
    total: number;
    freeShipping: boolean;
    items: PublicOrderItem<TDate>[];
    createdAt: TDate;
    updatedAt: TDate;
}
