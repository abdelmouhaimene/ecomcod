'use client';

import * as React from 'react';

export interface CartItem {
  id: string;
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
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  totalCount: number;
  subtotal: number;
  wishlist: string[];
  toggleWishlist: (id: string) => void;
  isWishlisted: (id: string) => boolean;
}

const StoreContext = React.createContext<StoreContextType | undefined>(undefined);

const initialCart: CartItem[] = [
  {
    id: 'aura-pro-studio',
    name: 'Aura Pro Studio Wireless Headphones',
    sku: 'AUR-PRO-01G',
    price: 349,
    originalPrice: 460,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAQ1MxMa7OdGkI_NRFfGRpESwB8ySKrS8b0AweaQWbaTRRwxkDsbLMelAGU4RDTb8jJ2NSd8ql91XgMCoby6VIaBYyp81-NVbwIIDgB3rATWlzo0GPC1nZLWPkaPRYnSP7We30l7shmI6Jx-sSKKSgJfSDXZpZCpmwZeggYJIssZBDerscxTmpi0T7CzyLF6vRes0ytJ_QKivzd-IZNLW-8a36bqP7L5Y1KSXriwCgKATqUiFfaVAZ6Lw',
    quantity: 1,
    material: 'Titanium Gold',
    tag: 'EDITION 01 OF 150',
  },
  {
    id: 'titanium-watch-ultra',
    name: 'Titanium Watch Ultra',
    sku: 'AUR-WTC-02T',
    price: 799,
    originalPrice: 899,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC9vuVvikSErCncwzMalAYoBWHq42QDuTtQF8xl_oLvtf5G5qPs294VV-wN16I_e4yspb5hiUKtQNp5pJ1crRKAhHkq9Kw6eIRmuU3ePcSVrNpA3wPaFvG9vlXyfWIF1BAzpnfzmyHs8YekjlHY4Gp1RhSmcN_5-N4s3NR1fXkVYTGsJ_kN9W5oYLJcMfPdkkQpIm7WNrouLPjCJbK5AplXV-Fmug8_0auujLzzeSpq9oZZ7pR0J1H_RA',
    quantity: 1,
    material: 'Grade 5 Titanium',
    tag: 'LIMITED DROP',
  },
];

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = React.useState<CartItem[]>(initialCart);
  const [wishlist, setWishlist] = React.useState<string[]>(['aura-pro-studio']);

  const addToCart = (item: Omit<CartItem, 'quantity'>, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ...item, quantity }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const next = i.quantity + delta;
            return next > 0 ? { ...i, quantity: next } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

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
