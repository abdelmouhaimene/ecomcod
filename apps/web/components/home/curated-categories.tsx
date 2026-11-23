'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { PublicCategory } from '@repo/types';
import { catalogApi } from '../../lib/api';
import { resolveMediaUrl } from '../../lib/catalog';

export function CuratedCategories({
  selectedCategory,
  onSelectCategory,
  children,
}: {
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  /** Product grid filtered by the selected category icon. */
  children?: React.ReactNode;
}) {
  const t = useTranslations('home');
  const [categories, setCategories] = React.useState<PublicCategory[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void catalogApi
      .listCategories()
      .then((result) => {
        if (!cancelled) setCategories(result);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="categories" className="w-full px-margin max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <span className="font-label-caps text-label-caps text-primary tracking-widest block uppercase">
            {t('hardwareCatalog')}
          </span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {t('curatedSegments')}
          </h2>
        </div>
        <button
          onClick={() => onSelectCategory('all')}
          className="font-label-caps text-label-caps text-primary flex items-center hover:underline underline-offset-4 cursor-pointer"
        >
          {t('allSpecs')}{' '}
          <span className="material-symbols-outlined text-[14px] ml-0.5">chevron_right</span>
        </button>
      </div>

      {/* Horizontal Scrollable Segment Pills */}
      <div className="flex space-x-3 overflow-x-auto no-scrollbar -mx-margin px-margin py-1">
        {loading ? (
          <p className="font-body-sm text-body-sm text-secondary">{t('categoriesLoading')}</p>
        ) : categories.length === 0 ? (
          <p className="font-body-sm text-body-sm text-secondary">{t('categoriesEmpty')}</p>
        ) : (
          categories.map((category) => {
            const isActive = selectedCategory === category.id;
            const iconUrl = resolveMediaUrl(category.icon);
            return (
              <button
                key={category.id}
                onClick={() => onSelectCategory(category.id)}
                className="flex flex-col items-center flex-shrink-0 group cursor-pointer"
                type="button"
              >
                <div
                  className={`w-16 h-16 rounded-full bg-surface-container-lowest p-1 shadow-sm flex items-center justify-center relative transition-all duration-200 group-active:scale-95 ${
                    isActive
                      ? 'border-2 border-primary-container ring-2 ring-primary-container/20'
                      : 'border border-outline-variant/40 hover:border-primary-container'
                  }`}
                >
                  <div
                    className={`w-full h-full rounded-full flex items-center justify-center overflow-hidden transition-colors ${
                      isActive ? 'bg-surface' : 'bg-surface-container-low/70'
                    }`}
                  >
                    {iconUrl ? (
                      <img
                        src={iconUrl}
                        alt=""
                        className="w-full h-full rounded-full object-contain"
                      />
                    ) : (
                      <span
                        className={`material-symbols-outlined text-[26px] transition-colors ${
                          isActive ? 'text-primary' : 'text-secondary group-hover:text-primary'
                        }`}
                        style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        category
                      </span>
                    )}
                  </div>
                  {isActive && (
                    <span className="absolute -bottom-0.5 w-2 h-2 rounded-full bg-primary-container ring-2 ring-surface-container-lowest animate-pulse"></span>
                  )}
                </div>
                <span
                  className={`font-label-caps text-[11px] mt-2 text-center transition-colors ${
                    isActive ? 'text-primary font-bold' : 'text-on-surface-variant font-medium'
                  }`}
                >
                  {category.name}
                </span>
              </button>
            );
          })
        )}
      </div>

      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
