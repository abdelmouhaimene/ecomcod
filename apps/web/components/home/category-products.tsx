'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { PublicProduct } from '@repo/types';
import { useStore } from '../../context/store-context';
import { catalogApi } from '../../lib/api';
import {
  formatPrice,
  getPrimaryImageUrl,
  getPrimarySku,
  getRating,
  getSalesCount,
} from '../../lib/catalog';

type FilterId = 'all' | 'trending' | 'audio' | 'wearables';

interface FeaturedCard {
  productId: string;
  skuId: string;
  name: string;
  tag: string;
  rating: string;
  price: number;
  spec: string;
  image: string;
}

const FILTER_PATTERNS: Partial<Record<FilterId, RegExp>> = {
  audio: /audio|sound|headphone|speaker|hi-fi|صوت|سماع/i,
  wearables: /wear|watch|ring|band|ساعة|خاتم/i,
};

export function FeaturedInnovations() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const { addToCart } = useStore();
  const [activeFilter, setActiveFilter] = React.useState<FilterId>('all');
  const [products, setProducts] = React.useState<PublicProduct[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void catalogApi
      .listProducts()
      .then((result) => {
        if (!cancelled) setProducts(result);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const currency = tCommon('currency');

  const filteredProducts = React.useMemo<FeaturedCard[]>(() => {
    const toCard = (product: PublicProduct): FeaturedCard => {
      const sku = getPrimarySku(product);
      const rating = getRating(product);
      return {
        productId: product.id,
        skuId: sku?.id ?? '',
        name: product.name,
        tag: product.families[0]?.name ?? product.categories[0]?.name ?? t('catalogTag'),
        rating: rating === null ? '—' : rating.toFixed(1),
        price: product.price,
        spec: product.subtitle ?? product.description ?? product.ref,
        image: getPrimaryImageUrl(product, sku),
      };
    };

    const keywords = (product: PublicProduct) =>
      [
        product.name,
        product.subtitle ?? '',
        product.description ?? '',
        ...product.families.map((family) => family.name),
        ...product.categories.map((category) => category.name),
      ].join(' ');

    if (activeFilter === 'all') return products.slice(0, 4).map(toCard);
    if (activeFilter === 'trending') {
      return [...products]
        .sort((a, b) => getSalesCount(b) - getSalesCount(a))
        .slice(0, 4)
        .map(toCard);
    }

    const pattern = FILTER_PATTERNS[activeFilter];
    return products
      .filter((product) => (pattern ? pattern.test(keywords(product)) : false))
      .slice(0, 4)
      .map(toCard);
  }, [products, activeFilter, t]);

  const addCardToCart = (card: FeaturedCard) => {
    if (!card.skuId) return;
    const product = products.find((candidate) => candidate.id === card.productId);
    const sku = product ? getPrimarySku(product) : undefined;
    addToCart({
      skuId: card.skuId,
      productId: card.productId,
      name: card.name,
      sku: sku?.sku ?? card.productId,
      price: card.price,
      image: card.image,
      material: sku?.label ?? card.tag,
    });
  };

  const filters: Array<{ id: FilterId; label: string }> = [
    { id: 'all', label: t('filterTags.all') },
    { id: 'trending', label: t('filterTags.trending') },
    { id: 'audio', label: t('filterTags.audio') },
    { id: 'wearables', label: t('filterTags.wearables') },
  ];

  return (
    <section className="w-full px-margin max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-label-caps text-label-caps text-primary tracking-widest block uppercase">
            {t('mechanicalRefinement')}
          </span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {t('featuredInnovations')}
          </h2>
        </div>
      </div>

      <div className="flex space-x-2 overflow-x-auto no-scrollbar py-1 mb-4">
        {filters.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-full font-label-caps text-[11px] tracking-wider transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-on-surface text-surface-container-lowest font-semibold shadow-sm'
                  : 'bg-surface-container-lowest border border-outline-variant/60 text-on-surface hover:border-primary-container'
              }`}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="rounded-xl bg-surface-container-low animate-pulse p-3 space-y-3"
            >
              <div className="h-4 w-16 rounded bg-surface-container" />
              <div className="h-32 rounded-lg bg-surface-container-lowest" />
              <div className="h-4 w-3/4 rounded bg-surface-container" />
              <div className="h-4 w-1/2 rounded bg-surface-container" />
            </div>
          ))}
          <p className="sr-only">{t('loading')}</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest subtle-hairline p-8 text-center">
          <span className="material-symbols-outlined text-[32px] text-outline">
            inventory_2
          </span>
          <p className="font-body-sm text-secondary mt-2">
            {products.length === 0 ? t('emptyProducts') : t('filterNoResults')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {filteredProducts.map((prod) => (
            <article
              key={prod.productId}
              className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-3 flex flex-col justify-between hover:border-primary-container/60 transition-all gold-glow-subtle group"
            >
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-1.5 py-0.5 rounded bg-surface border border-primary-container/60 text-primary font-label-caps text-[9px] font-bold line-clamp-1">
                    {prod.tag}
                  </span>
                  <div className="flex items-center text-primary space-x-0.5">
                    <span
                      className="material-symbols-outlined text-[13px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                    <span className="font-label-numeric text-[11px] font-semibold text-on-surface">
                      {prod.rating}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/products/${encodeURIComponent(prod.productId)}`}
                  className="w-full h-32 sm:h-40 rounded-lg bg-surface-container-low overflow-hidden relative flex items-center justify-center border border-outline-variant/20 mb-2.5 block"
                >
                  {prod.image ? (
                    <img
                      src={prod.image}
                      alt={t('imageAlt', { name: prod.name })}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[36px] text-outline">
                      image
                    </span>
                  )}
                </Link>

                <Link href={`/products/${encodeURIComponent(prod.productId)}`}>
                  <h3 className="font-title-md text-[14px] leading-tight text-on-surface font-semibold line-clamp-1 hover:text-primary transition-colors">
                    {prod.name}
                  </h3>
                </Link>
                <p className="font-body-sm text-[11px] text-outline mt-0.5 line-clamp-1">
                  {prod.spec}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between">
                <span className="font-label-numeric text-[15px] font-bold text-on-surface">
                  {formatPrice(prod.price, currency)}
                </span>
                <button
                  onClick={() => addCardToCart(prod)}
                  disabled={!prod.skuId}
                  aria-label={t('addProductToBag', { name: prod.name })}
                  className="w-8 h-8 rounded-lg bg-on-surface text-surface-container-lowest flex items-center justify-center border border-primary-container/40 active:scale-90 transition-all hover:bg-primary cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[17px]">
                    add_shopping_cart
                  </span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
