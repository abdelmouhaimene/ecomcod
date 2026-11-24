'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { PublicProduct } from '@repo/types';
import { useStore } from '../../context/store-context';
import {
  formatPrice,
  getPrimaryImageUrl,
  getPrimarySku,
  getRating,
} from '../../lib/catalog';

/** Shared storefront card used by the home grid and the full catalog. */
export function ProductCard({ product }: { product: PublicProduct }) {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const { addToCart } = useStore();

  const sku = getPrimarySku(product);
  const rating = getRating(product);
  const tag = product.families[0]?.name ?? product.categories[0]?.name ?? t('catalogTag');
  const image = getPrimaryImageUrl(product, sku);
  const spec = product.subtitle ?? product.description ?? product.ref;
  const currency = tCommon('currency');

  const addToBag = () => {
    if (!sku) return;
    addToCart({
      skuId: sku.id,
      productId: product.id,
      name: product.name,
      sku: sku.sku,
      price: product.price,
      image,
      material: sku.label ?? tag,
    });
  };

  return (
    <article className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-3 flex flex-col justify-between hover:border-primary-container/60 transition-all gold-glow-subtle group">
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="px-1.5 py-0.5 rounded bg-surface border border-primary-container/60 text-primary font-label-caps text-[9px] font-bold line-clamp-1">
            {tag}
          </span>
          <div className="flex items-center text-primary space-x-0.5">
            <span
              className="material-symbols-outlined text-[13px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              star
            </span>
            <span className="font-label-numeric text-[11px] font-semibold text-on-surface">
              {rating === null ? '—' : rating.toFixed(1)}
            </span>
          </div>
        </div>

        <Link
          href={`/products/${encodeURIComponent(product.id)}`}
          className="w-full h-32 sm:h-40 rounded-lg bg-surface-container-low overflow-hidden relative flex items-center justify-center border border-outline-variant/20 mb-2.5 block"
        >
          {image ? (
            <img
              src={image}
              alt={t('imageAlt', { name: product.name })}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <span className="material-symbols-outlined text-[36px] text-outline">
              image
            </span>
          )}
        </Link>

        <Link href={`/products/${encodeURIComponent(product.id)}`}>
          <h3 className="font-title-md text-[14px] leading-tight text-on-surface font-semibold line-clamp-1 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>
        <p className="font-body-sm text-[11px] text-outline mt-0.5 line-clamp-1">{spec}</p>
      </div>

      <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between">
        <span className="font-label-numeric text-[15px] font-bold text-on-surface">
          {formatPrice(product.price, currency)}
        </span>
        <button
          onClick={addToBag}
          disabled={!sku}
          aria-label={t('addProductToBag', { name: product.name })}
          className="w-8 h-8 rounded-lg bg-on-surface text-surface-container-lowest flex items-center justify-center border border-primary-container/40 active:scale-90 transition-all hover:bg-primary cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          type="button"
        >
          <span className="material-symbols-outlined text-[17px]">
            add_shopping_cart
          </span>
        </button>
      </div>
    </article>
  );
}
