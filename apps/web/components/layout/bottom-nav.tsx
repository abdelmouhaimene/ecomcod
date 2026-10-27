'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useStore } from '../../context/store-context';

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { totalCount } = useStore();

  const isHome = pathname === '/';
  const isCart = pathname === '/checkout';

  return (
    <nav className="fixed bottom-0 w-full z-50 rounded-t-xl md:hidden bg-surface/90 dark:bg-inverse-surface/90 backdrop-blur-lg border-t border-outline-variant/30 dark:border-outline/20 shadow-lg inset-x-0">
      <div className="flex justify-around items-center px-space-md py-space-sm max-w-lg mx-auto">
        {/* 1. Home */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center active:scale-95 transition-transform duration-150 ${
            isHome
              ? 'text-primary dark:text-inverse-primary font-semibold'
              : 'text-secondary dark:text-secondary-fixed-dim hover:text-primary dark:hover:text-primary-fixed'
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={isHome ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            home
          </span>
          <span className="font-label-caps text-label-caps mt-0.5">{t('home')}</span>
        </Link>

        {/* 2. Categories */}
        <a
          href="/#categories"
          className="flex flex-col items-center justify-center text-secondary dark:text-secondary-fixed-dim active:scale-95 transition-transform duration-150 hover:text-primary dark:hover:text-primary-fixed"
        >
          <span className="material-symbols-outlined text-[24px]">grid_view</span>
          <span className="font-label-caps text-label-caps mt-0.5">{t('categories')}</span>
        </a>

        {/* 3. Cart */}
        <Link
          href="/checkout"
          className={`flex flex-col items-center justify-center active:scale-95 transition-transform duration-150 relative ${
            isCart
              ? 'text-primary dark:text-inverse-primary font-semibold'
              : 'text-secondary dark:text-secondary-fixed-dim hover:text-primary dark:hover:text-primary-fixed'
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={isCart ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            shopping_bag
          </span>
          <span className="font-label-caps text-label-caps mt-0.5">{t('cart')}</span>
          {totalCount > 0 && (
            <span className="absolute top-0 right-1 w-4 h-4 rounded-full bg-primary text-on-primary text-[9px] font-bold flex items-center justify-center font-label-numeric">
              {totalCount}
            </span>
          )}
        </Link>

        {/* 4. Tracking / Account */}
        <Link
          href="/order-confirmation"
          className="flex flex-col items-center justify-center text-secondary dark:text-secondary-fixed-dim active:scale-95 transition-transform duration-150 hover:text-primary dark:hover:text-primary-fixed"
        >
          <span className="material-symbols-outlined text-[24px]">local_shipping</span>
          <span className="font-label-caps text-label-caps mt-0.5">Tracking</span>
        </Link>
      </div>
    </nav>
  );
}
