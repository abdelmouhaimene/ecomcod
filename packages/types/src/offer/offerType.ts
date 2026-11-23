/**
 * Offer contracts. Offers are defined per product, never per variant: the
 * admin picks products and the client chooses the concrete SKU (variant) of
 * each offered product when applying the offer at checkout. Prices come from
 * the product, so every one of its SKUs has the same base price.
 */
export const OFFER_TYPES = ['SINGLE_PRODUCT', 'PACK'] as const;
export type OfferType = (typeof OFFER_TYPES)[number];

export const SINGLE_OFFER_MODES = ['BUY_X_GET_Y_FREE', 'BUY_X_GET_FREE_SHIPPING'] as const;
export type SingleOfferMode = (typeof SINGLE_OFFER_MODES)[number];

export interface PublicOfferSingleRule<TDate = string> {
    id: string;
    offerId: string;
    productId: string;
    mode: SingleOfferMode;
    buyQuantity: number;
    /** `null` for free-shipping offers. */
    freeQuantity: number | null;
    createdAt: TDate;
}

export interface PublicOfferPackItem<TDate = string> {
    id: string;
    offerId: string;
    productId: string;
    quantity: number;
    createdAt: TDate;
}

export interface PublicOffer<TDate = string> {
    id: string;
    name: string;
    type: OfferType;
    isActive: boolean;
    startsAt: TDate | null;
    endsAt: TDate | null;
    /**
     * True when the offer grants free shipping. Derived from the single rule
     * mode so clients can use it for shipping calculations without re-deriving
     * the offer semantics.
     */
    freeShipping: boolean;
    /** Fixed bundle price, only for `PACK` offers. */
    packPrice: number | null;
    singleRule: PublicOfferSingleRule<TDate> | null;
    packItems: PublicOfferPackItem<TDate>[];
    createdAt: TDate;
    updatedAt: TDate;
}

export interface SingleRulePayload {
    productId: string;
    mode: SingleOfferMode;
    buyQuantity: number;
    freeQuantity?: number | null;
}

export interface PackItemPayload {
    productId: string;
    quantity: number;
}

export interface OfferPayload {
    name: string;
    type: OfferType;
    isActive: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    packPrice?: number | null;
    singleRule?: SingleRulePayload | null;
    packItems?: PackItemPayload[];
}
