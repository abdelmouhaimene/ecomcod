'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { PublicProduct } from '@repo/types';
import { ProductCard } from '../catalog/product-card';
import { catalogApi } from '../../lib/api';

/** First nine catalog products, optionally narrowed to the selected category. */
export function CategoryProducts({ selectedCategory }: { selectedCategory: string }) {
  const t = useTranslations('home');
  const [products, setProducts] = React.useState<PublicProduct[]>([]);
  const [loading, setLoading] = React.useState(true);

  const categoryId =
    selectedCategory && selectedCategory !== 'all' ? selectedCategory : undefined;

  React.useEffect(() => {
    let cancelled = false;
    setProducts([]);
    setLoading(true);
    void catalogApi
      .listProducts({ limit: 9, categoryId })
      .then((result) => {
        if (!cancelled) setProducts(result.items);
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
  }, [categoryId]);

  return (
    <div>
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
      ) : products.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest subtle-hairline p-8 text-center">
          <span className="material-symbols-outlined text-[32px] text-outline">
            inventory_2
          </span>
          <p className="font-body-sm text-secondary mt-2">
            {categoryId ? t('filterNoResults') : t('emptyProducts')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-center">
        <Link
          href="/products"
          className="font-label-caps text-label-caps text-primary flex items-center hover:underline underline-offset-4"
        >
          {t('exploreAll')}
          <span className="material-symbols-outlined text-[14px] ml-0.5">chevron_right</span>
        </Link>
      </div>
    </div>
  );
}
