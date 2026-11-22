'use client';

import * as React from 'react';

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

interface StoreContextType {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
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
  version: 1;
  cart: CartItem[];
  wishlist: string[];
}

const STORAGE_KEY = 'ecomcod-cart';

const StoreContext = React.createContext<StoreContextType | undefined>(undefined);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Accepts current versioned payloads and safely discards malformed legacy data. */
function parseCartItem(value: unknown): CartItem | null {
  if (!isRecord(value)) return null;

  const skuId = typeof value.skuId === 'string' ? value.skuId : '';
  const price = finiteNumber(value.price);
  const quantity = finiteNumber(value.quantity);
  if (!skuId || price === null || quantity === null || quantity < 1) return null;

  const item: CartItem = {
    skuId,
    productId: typeof value.productId === 'string' ? value.productId : '',
    name: typeof value.name === 'string' ? value.name : '',
    sku: typeof value.sku === 'string' ? value.sku : skuId,
    price,
    image: typeof value.image === 'string' ? value.image : '',
    quantity: Math.max(1, Math.floor(quantity)),
    material: typeof value.material === 'string' ? value.material : '',
  };

  const originalPrice = finiteNumber(value.originalPrice);
  if (originalPrice !== null) item.originalPrice = originalPrice;
  if (typeof value.tag === 'string') item.tag = value.tag;

  return item;
}

function parsePersistedStore(value: unknown): PersistedStore {
  const empty: PersistedStore = { version: 1, cart: [], wishlist: [] };

  // Very old versions stored a bare cart array with slug ids; those entries
  // have no real SKU id, so they are ignored instead of breaking checkout.
  const rawCart: unknown[] = Array.isArray(value)
    ? value
    : isRecord(value) && (value.version === undefined || value.version === 1) && Array.isArray(value.cart)
      ? value.cart
      : [];
  const rawWishlist: unknown[] =
    !Array.isArray(value) && isRecord(value) && Array.isArray(value.wishlist)
      ? value.wishlist
      : [];

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

  return { version: 1, cart, wishlist: [...new Set(wishlist)] };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [wishlist, setWishlist] = React.useState<string[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parsePersistedStore(JSON.parse(stored) as unknown);
        setCart(parsed.cart);
        setWishlist(parsed.wishlist);
      }
    } catch {
      // Corrupt storage should never prevent the storefront from rendering.
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: PersistedStore = { version: 1, cart, wishlist };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage can be disabled (private mode / quota); the cart still works in memory.
    }
  }, [cart, wishlist, hydrated]);

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

  const clearCart = () => setCart([]);

  const toggleWishlist = (id: string) => {
    setWishlist((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isWishlisted = (id: string) => wishlist.includes(id);

  const totalCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <StoreContext.Provider
      value={{
        cart,
        addToCart,
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
