'use client';

import * as React from 'react';
import type { AppliedOfferSelectionPayload } from '@repo/types';

export interface CartItem {
  /** Real database SKU id used by the order API. */
  skuId: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  originalPrice?: number;
  image: string;
  quantity: number;
  material: string;
  tag?: string;
}

export interface AppliedOfferItem {
  skuId: string;
  productId: string;
  name: string;
  sku: string;
  image: string;
  material: string;
  quantity: number;
  unitPrice: number;
  /** Free units are added by the API, but shown here so the bag is transparent. */
  isFree?: boolean;
}

export type AppliedOfferMode = 'SINGLE_PRODUCT' | 'PACK';

/**
 * Offers stored with the cart. The order API needs the chosen SKU for every
 * unit of an offered product; it adds free/pack lines itself, so those lines
 * are only display data.
 */
export interface AppliedCartOffer {
  id: string;
  offerId: string;
  name: string;
  mode: AppliedOfferMode;
  times: number;
  selections: AppliedOfferSelectionPayload[];
  items: AppliedOfferItem[];
  /** Discounted amount the customer pays for this offer. */
  total: number;
  freeShipping: boolean;
}

interface StoreContextType {
  cart: CartItem[];
  appliedOffers: AppliedCartOffer[];
  addToCart: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  addOfferToCart: (offer: Omit<AppliedCartOffer, 'id'>) => void;
  removeAppliedOffer: (id: string) => void;
  removeFromCart: (skuId: string) => void;
  updateQuantity: (skuId: string, delta: number) => void;
  clearCart: () => void;
  totalCount: number;
  subtotal: number;
  wishlist: string[];
  toggleWishlist: (id: string) => void;
  isWishlisted: (id: string) => boolean;
}

interface PersistedStore {
  version: 2;
  cart: CartItem[];
  wishlist: string[];
  appliedOffers: AppliedCartOffer[];
}

const STORAGE_KEY = 'ecomcod-cart';

const StoreContext = React.createContext<StoreContextType | undefined>(undefined);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Accepts current versioned payloads and safely discards malformed legacy data. */
function parseCartItem(value: unknown): CartItem | null {
  if (!isRecord(value)) return null;

  const skuId = text(value.skuId);
  const price = finiteNumber(value.price);
  const quantity = finiteNumber(value.quantity);
  if (!skuId || price === null || quantity === null || quantity < 1) return null;

  const item: CartItem = {
    skuId,
    productId: text(value.productId),
    name: text(value.name),
    sku: text(value.sku, skuId),
    price,
    image: text(value.image),
    quantity: Math.max(1, Math.floor(quantity)),
    material: text(value.material),
  };

  const originalPrice = finiteNumber(value.originalPrice);
  if (originalPrice !== null) item.originalPrice = originalPrice;
  if (typeof value.tag === 'string') item.tag = value.tag;

  return item;
}

function parseAppliedOfferItem(value: unknown): AppliedOfferItem | null {
  if (!isRecord(value)) return null;

  const skuId = text(value.skuId);
  const productId = text(value.productId);
  const quantity = finiteNumber(value.quantity);
  const unitPrice = finiteNumber(value.unitPrice);
  if (
    !skuId ||
    !productId ||
    quantity === null ||
    quantity < 1 ||
    unitPrice === null ||
    unitPrice < 0
  ) {
    return null;
  }

  const item: AppliedOfferItem = {
    skuId,
    productId,
    name: text(value.name),
    sku: text(value.sku, skuId),
    image: text(value.image),
    material: text(value.material),
    quantity: Math.max(1, Math.floor(quantity)),
    unitPrice,
  };
  if (value.isFree === true) item.isFree = true;
  return item;
}

function parseSelection(value: unknown): AppliedOfferSelectionPayload | null {
  if (!isRecord(value)) return null;
  const productId = text(value.productId);
  const skuId = text(value.skuId);
  if (!productId || !skuId) return null;

  const rawQuantity = finiteNumber(value.quantity);
  if (rawQuantity === null) return { productId, skuId };
  if (!Number.isInteger(rawQuantity) || rawQuantity < 1) return null;
  return { productId, skuId, quantity: rawQuantity };
}

function parseAppliedCartOffer(value: unknown): AppliedCartOffer | null {
  if (!isRecord(value)) return null;

  const id = text(value.id);
  const offerId = text(value.offerId);
  const mode = value.mode;
  const times = finiteNumber(value.times);
  const total = finiteNumber(value.total);
  if (
    !id ||
    !offerId ||
    (mode !== 'SINGLE_PRODUCT' && mode !== 'PACK') ||
    times === null ||
    times < 1 ||
    total === null ||
    total < 0 ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.selections)
  ) {
    return null;
  }

  const items = value.items
    .map(parseAppliedOfferItem)
    .filter((item): item is AppliedOfferItem => item !== null);
  const selections = value.selections
    .map(parseSelection)
    .filter((selection): selection is AppliedOfferSelectionPayload => selection !== null);
  if (items.length === 0 || selections.length === 0) return null;

  return {
    id,
    offerId,
    name: text(value.name),
    mode,
    times: Math.max(1, Math.floor(times)),
    selections,
    items,
    total,
    freeShipping: value.freeShipping === true,
  };
}

function arrayValue(value: Record<string, unknown>, key: string): unknown[] {
  const candidate = value[key];
  return Array.isArray(candidate) ? candidate : [];
}

function parsePersistedStore(value: unknown): PersistedStore {
  const empty: PersistedStore = { version: 2, cart: [], wishlist: [], appliedOffers: [] };
  if (
    !isRecord(value) ||
    (value.version !== undefined && value.version !== 1 && value.version !== 2)
  ) {
    return empty;
  }

  // Very old versions stored a bare cart array with slug ids; those entries
  // have no real SKU id, so they are ignored instead of breaking checkout.
  const rawCart: unknown[] = Array.isArray(value) ? value : arrayValue(value, 'cart');
  const rawWishlist: unknown[] = Array.isArray(value) ? [] : arrayValue(value, 'wishlist');
  const rawOffers: unknown[] = Array.isArray(value) ? [] : arrayValue(value, 'appliedOffers');

  const cart: CartItem[] = [];
  for (const rawItem of rawCart) {
    const item = parseCartItem(rawItem);
    if (!item) continue;
    const existing = cart.find((candidate) => candidate.skuId === item.skuId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      cart.push(item);
    }
  }

  const wishlist = rawWishlist.filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  );
  const appliedOffers = rawOffers
    .map(parseAppliedCartOffer)
    .filter((offer): offer is AppliedCartOffer => offer !== null);

  return {
    version: 2,
    cart,
    wishlist: [...new Set(wishlist)],
    appliedOffers,
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [appliedOffers, setAppliedOffers] = React.useState<AppliedCartOffer[]>([]);
  const [wishlist, setWishlist] = React.useState<string[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parsePersistedStore(JSON.parse(stored) as unknown);
        setCart(parsed.cart);
        setWishlist(parsed.wishlist);
        setAppliedOffers(parsed.appliedOffers);
      }
    } catch {
      // Corrupt storage should never prevent the storefront from rendering.
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: PersistedStore = { version: 2, cart, wishlist, appliedOffers };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage can be disabled (private mode / quota); the cart still works in memory.
    }
  }, [cart, wishlist, appliedOffers, hydrated]);

  const addToCart = (item: Omit<CartItem, 'quantity'>, quantity = 1) => {
    if (!item.skuId || quantity < 1) return;
    const added = Math.floor(quantity);
    setCart((prev) => {
      const existing = prev.find((entry) => entry.skuId === item.skuId);
      if (existing) {
        return prev.map((entry) =>
          entry.skuId === item.skuId
            ? { ...entry, quantity: entry.quantity + added }
            : entry
        );
      }
      return [...prev, { ...item, quantity: added }];
    });
  };

  const addOfferToCart = (offer: Omit<AppliedCartOffer, 'id'>) => {
    if (!offer.offerId || offer.selections.length === 0 || offer.items.length === 0) return;
    setAppliedOffers((prev) =>
      prev.some((entry) => entry.offerId === offer.offerId)
        ? prev
        : [...prev, { ...offer, id: createId() }]
    );
  };

  const removeAppliedOffer = (id: string) => {
    setAppliedOffers((prev) => prev.filter((offer) => offer.id !== id));
  };

  const removeFromCart = (skuId: string) => {
    setCart((prev) => prev.filter((entry) => entry.skuId !== skuId));
  };

  const updateQuantity = (skuId: string, delta: number) => {
    if (!delta) return;
    setCart((prev) =>
      prev.flatMap((entry) => {
        if (entry.skuId !== skuId) return [entry];
        const next = entry.quantity + delta;
        return next > 0 ? [{ ...entry, quantity: next }] : [];
      })
    );
  };

  const clearCart = () => {
    setCart([]);
    setAppliedOffers([]);
  };

  const toggleWishlist = (id: string) => {
    setWishlist((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isWishlisted = (id: string) => wishlist.includes(id);

  const totalCount =
    cart.reduce((acc, item) => acc + item.quantity, 0) +
    appliedOffers.reduce(
      (acc, offer) => acc + offer.items.reduce((sum, item) => sum + item.quantity, 0),
      0
    );
  const subtotal =
    cart.reduce((acc, item) => acc + item.price * item.quantity, 0) +
    appliedOffers.reduce((acc, offer) => acc + offer.total, 0);

  return (
    <StoreContext.Provider
      value={{
        cart,
        appliedOffers,
        addToCart,
        addOfferToCart,
        removeAppliedOffer,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalCount,
        subtotal,
        wishlist,
        toggleWishlist,
        isWishlisted,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = React.useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
