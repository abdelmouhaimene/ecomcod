'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

export function CuratedCategories({
  selectedCategory,
  onSelectCategory,
}: {
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
}) {
  const t = useTranslations('home');

  const categories = [
    { id: 'audio', label: t('categories.audio'), icon: 'headphones' },
    { id: 'wearables', label: t('categories.wearables'), icon: 'watch' },
    { id: 'power', label: t('categories.power'), icon: 'bolt' },
    { id: 'desk', label: t('categories.desk'), icon: 'desktop_windows' },
    { id: 'optics', label: t('categories.optics'), icon: 'visibility' },
    { id: 'cases', label: t('categories.cases'), icon: 'cases' },
  ];

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
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
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
                  className={`w-full h-full rounded-full flex items-center justify-center transition-colors ${
                    isActive ? 'bg-surface' : 'bg-surface-container-low/70'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[26px] transition-colors ${
                      isActive ? 'text-primary' : 'text-secondary group-hover:text-primary'
                    }`}
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {cat.icon}
                  </span>
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
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
