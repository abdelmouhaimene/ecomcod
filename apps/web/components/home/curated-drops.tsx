'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { PublicProduct } from '@repo/types';
import { useStore } from '../../context/store-context';
import { catalogApi } from '../../lib/api';
import { formatPrice, getPrimaryImageUrl, getPrimarySku } from '../../lib/catalog';

interface DropCard {
  productId: string;
  skuId: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  image: string;
  price: number;
  originalPrice?: number;
  material: string;
  tag: string;
}

export function CuratedDrops() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const { addToCart } = useStore();
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
  const cards = React.useMemo<DropCard[]>(
    () =>
      products.slice(0, 3).map((product) => {
        const sku = getPrimarySku(product);
        return {
          productId: product.id,
          skuId: sku?.id ?? '',
          sku: sku?.sku ?? product.ref,
          name: product.name,
          description: product.subtitle ?? product.description ?? '',
          category:
            product.families[0]?.name ??
            product.categories[0]?.name ??
            t('catalogTag'),
          image: getPrimaryImageUrl(product, sku),
          price: product.price,
          originalPrice: product.oldPrice ?? undefined,
          material: sku?.label ?? product.families[0]?.name ?? product.name,
          tag: product.ref,
        };
      }),
    [products, t]
  );

  const addCardToCart = (card: DropCard) => {
    if (!card.skuId) return;
    addToCart({
      skuId: card.skuId,
      productId: card.productId,
      name: card.name,
      sku: card.sku,
      price: card.price,
      originalPrice: card.originalPrice,
      image: card.image,
      material: card.material,
      tag: card.tag,
    });
  };

  return (
    <section className="w-full px-margin overflow-hidden max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-3.5 bg-primary-container rounded-full"></span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {t('curatedDrops')}
          </h2>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-4 h-1 bg-primary rounded-full"></span>
          <span className="w-1.5 h-1 bg-outline-variant rounded-full"></span>
          <span className="w-1.5 h-1 bg-outline-variant rounded-full"></span>
        </div>
      </div>

      {loading ? (
        <div className="flex space-x-4 overflow-x-auto no-scrollbar py-2 -mx-margin px-margin">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="min-w-[80vw] sm:min-w-[360px] max-w-[88vw] sm:max-w-[480px] flex-shrink-0 rounded-xl bg-surface-container-low animate-pulse space-y-3 p-4"
            >
              <div className="h-5 w-24 rounded bg-surface-container" />
              <div className="h-48 rounded-lg bg-surface-container-lowest" />
              <div className="h-5 w-3/4 rounded bg-surface-container" />
              <div className="h-4 w-1/2 rounded bg-surface-container" />
            </div>
          ))}
          <p className="sr-only">{t('loading')}</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest subtle-hairline p-8 text-center">
          <span className="material-symbols-outlined text-[32px] text-outline">
            inventory_2
          </span>
          <p className="font-body-sm text-secondary mt-2">{t('emptyProducts')}</p>
        </div>
      ) : (
        <div className="flex space-x-4 overflow-x-auto no-scrollbar py-2 -mx-margin px-margin snap-x snap-mandatory">
          {cards.map((card, index) =>
            index === 0 ? (
              <article
                key={card.productId}
                className="min-w-[88vw] sm:min-w-[440px] md:min-w-[480px] max-w-[88vw] sm:max-w-[480px] flex-shrink-0 snap-center rounded-xl bg-surface-container-lowest border border-primary-container/40 p-4 gold-glow-subtle flex flex-col relative overflow-hidden transition-all duration-300 hover:border-primary-container"
              >
                <div className="absolute -right-12 -top-12 w-36 h-36 bg-primary-container/10 rounded-full blur-2xl pointer-events-none"></div>

                <div className="flex items-center justify-between mb-3 z-10">
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-surface border border-primary-container rounded text-primary font-label-caps text-[10px] font-semibold tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
                    <span>{t('liveDrop')}</span>
                  </span>
                  <span className="px-2 py-0.5 bg-on-surface text-on-primary rounded font-label-caps text-[10px]">
                    {t('availableNow')}
                  </span>
                </div>

                <Link
                  href={`/products/${encodeURIComponent(card.productId)}`}
                  className="w-full h-48 sm:h-56 rounded-lg bg-surface-container-low overflow-hidden relative mb-3.5 flex items-center justify-center border border-outline-variant/20 group"
                >
                  {card.image ? (
                    <img
                      src={card.image}
                      alt={t('imageAlt', { name: card.name })}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[40px] text-outline">
                      image
                    </span>
                  )}
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-on-surface/90 text-surface-container-lowest rounded font-label-caps text-[9px] tracking-widest backdrop-blur-sm">
                    {card.tag}
                  </span>
                </Link>

                <div className="flex flex-col flex-1 justify-between z-10">
                  <div>
                    <p className="font-label-caps text-label-caps text-primary uppercase tracking-widest mb-0.5">
                      {card.category}
                    </p>
                    <Link href={`/products/${encodeURIComponent(card.productId)}`}>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-tight hover:text-primary transition-colors">
                        {card.name}
                      </h3>
                    </Link>
                    <p className="font-body-sm text-body-sm text-on-surface-variant/80 mt-1 line-clamp-2">
                      {card.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-outline-variant/30 flex items-center justify-between">
                    <div>
                      <span className="font-label-caps text-[10px] text-outline uppercase block">
                        {t('currentTier')}
                      </span>
                      <div className="flex items-baseline space-x-2">
                        <span className="font-label-numeric text-[20px] font-bold text-on-surface">
                          {formatPrice(card.price, currency)}
                        </span>
                        {card.originalPrice && card.originalPrice > card.price && (
                          <span className="font-label-numeric text-body-sm text-outline line-through">
                            {formatPrice(card.originalPrice, currency)}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => addCardToCart(card)}
                      disabled={!card.skuId}
                      className="px-4 py-2 bg-on-surface text-surface-container-lowest rounded-lg border border-primary-container/60 font-label-caps text-[11px] font-semibold tracking-wider flex items-center space-x-1.5 gold-glow-interactive active:scale-95 transition-all hover:bg-primary disabled:opacity-50 disabled:pointer-events-none"
                      type="button"
                      aria-label={t('addProductToBag', { name: card.name })}
                    >
                      <span>{tCommon('claimOffer')}</span>
                      <span className="material-symbols-outlined text-[15px] text-primary-fixed-dim">
                        arrow_forward
                      </span>
                    </button>
                  </div>
                </div>
              </article>
            ) : (
              <article
                key={card.productId}
                className="min-w-[80vw] sm:min-w-[340px] max-w-[80vw] sm:max-w-[360px] flex-shrink-0 snap-center rounded-xl bg-surface-container-lowest border border-outline-variant/40 p-4 flex flex-col justify-between opacity-95 hover:border-primary-container/60 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 bg-surface-container border border-outline-variant rounded font-label-caps text-[10px] text-secondary">
                      {index === 1 ? t('limitedDrop') : t('availableNow')}
                    </span>
                    <span className="font-label-numeric text-[11px] text-primary font-semibold">
                      {formatPrice(card.price, currency)}
                    </span>
                  </div>
                  <Link
                    href={`/products/${encodeURIComponent(card.productId)}`}
                    className="w-full h-44 rounded-lg bg-surface-container-low overflow-hidden relative mb-3 border border-outline-variant/20 flex items-center justify-center"
                  >
                    {card.image ? (
                      <img
                        src={card.image}
                        alt={t('imageAlt', { name: card.name })}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-[36px] text-outline">
                        image
                      </span>
                    )}
                  </Link>
                  <p className="font-label-caps text-label-caps text-primary tracking-widest">
                    {card.category}
                  </p>
                  <Link href={`/products/${encodeURIComponent(card.productId)}`}>
                    <h3 className="font-headline-sm text-title-md text-on-surface font-semibold line-clamp-1 hover:text-primary transition-colors">
                      {card.name}
                    </h3>
                  </Link>
                </div>

                <div className="mt-4 pt-3 border-t border-outline-variant/30 flex items-center justify-between gap-3">
                  <span className="font-label-caps text-[11px] text-on-surface-variant line-clamp-2">
                    {card.material}
                  </span>
                  <button
                    onClick={() => addCardToCart(card)}
                    disabled={!card.skuId}
                    className="p-2 border border-outline-variant/60 rounded-lg text-primary hover:bg-surface-container active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                    type="button"
                    aria-label={t('addProductToBag', { name: card.name })}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      add_shopping_cart
                    </span>
                  </button>
                </div>
              </article>
            )
          )}
        </div>
      )}
    </section>
  );
}
