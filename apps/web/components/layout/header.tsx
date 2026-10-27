'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ThemeToggle } from '../theme-toggle';
import { LanguageSelector } from '../language-selector';
import { useStore } from '../../context/store-context';

export function Header({ currentLocale = 'en' }: { currentLocale?: string }) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const { totalCount } = useStore();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  return (
    <>
      <header className="docked full-width top-0 sticky z-50 bg-surface/85 dark:bg-inverse-surface/85 backdrop-blur-md shadow-sm border-b border-outline-variant/30 transition-all duration-200">
        {/* Top Utility & Brand Strip */}
        <div className="flex items-center justify-between px-margin py-space-sm max-w-7xl mx-auto w-full">
          {/* Leading: Menu Icon */}
          <button
            aria-label={t('menu')}
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-primary hover:text-primary transition-all duration-200 ease-out active:scale-95 rounded hover:bg-surface-container-low"
            type="button"
          >
            <span className="material-symbols-outlined text-[24px]">
              {menuOpen ? 'close' : 'menu'}
            </span>
          </button>

          {/* Center Brand Anchor */}
          <div className="flex flex-col items-center">
            <Link
              href="/"
              className="font-label-caps text-label-caps tracking-widest text-primary dark:text-inverse-primary uppercase font-bold hover:opacity-90 transition-opacity"
            >
              {tCommon('brandName')}
            </Link>
            <span className="font-label-caps text-[9px] tracking-[0.22em] text-on-surface-variant/80 -mt-0.5">
              {tCommon('brandSubtitle')}
            </span>
          </div>

          {/* Trailing Action Cluster */}
          <div className="flex items-center space-x-2">
            {/* Language Selector */}
            <LanguageSelector currentLocale={currentLocale} />

            {/* Dark Mode Toggle */}
            <ThemeToggle />

            {/* Cart Bag with Badge */}
            <Link
              href="/checkout"
              aria-label={`${t('cart')} with ${totalCount} items`}
              className="relative p-1.5 text-primary hover:text-primary active:scale-95 transition-transform rounded hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
              {totalCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-primary text-on-primary font-label-numeric text-[10px] flex items-center justify-center rounded-full font-semibold ring-2 ring-surface">
                  {totalCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Integrated Search Field */}
        <div className="px-margin py-2 bg-surface/50 border-t border-outline-variant/20">
          <div className="relative flex items-center w-full max-w-7xl mx-auto">
            <span className="material-symbols-outlined absolute left-3 text-[18px] text-primary">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tCommon('search')}
              className="w-full pl-9 pr-9 py-2 bg-surface-container-lowest text-on-surface placeholder:text-outline/70 border border-outline-variant/50 rounded-lg font-body-sm text-body-sm focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container/40 transition-all shadow-sm"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="material-symbols-outlined absolute right-3 text-[18px] text-outline hover:text-on-surface"
              >
                close
              </button>
            ) : (
              <span className="material-symbols-outlined absolute right-3 text-[18px] text-outline/60 cursor-pointer">
                tune
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Slide-out Menu Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative z-10 w-80 max-w-[85vw] bg-surface-container-lowest dark:bg-inverse-surface border-r border-outline-variant/30 h-full p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20 mb-6">
                <div>
                  <h3 className="font-label-caps text-label-caps tracking-widest text-primary uppercase font-bold">
                    {tCommon('brandName')}
                  </h3>
                  <p className="font-label-caps text-[9px] text-on-surface-variant tracking-wider">
                    {tCommon('brandSubtitle')}
                  </p>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-1 text-on-surface-variant hover:text-primary rounded-full"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <nav className="flex flex-col space-y-3 font-title-md text-[15px]">
                <Link
                  href="/"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-surface-container-low text-on-surface hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-[20px]">home</span>
                  <span>{t('home')}</span>
                </Link>
                <Link
                  href="/products/aura-pro-studio"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-surface-container-low text-on-surface hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    headphones
                  </span>
                  <span>Aura Pro Studio</span>
                </Link>
                <Link
                  href="/checkout"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-surface-container-low text-on-surface hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    shopping_bag
                  </span>
                  <span>{t('cart')}</span>
                  {totalCount > 0 && (
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold font-label-numeric">
                      {totalCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/order-confirmation"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-surface-container-low text-on-surface hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    local_shipping
                  </span>
                  <span>Order Tracking</span>
                </Link>
              </nav>
            </div>

            <div className="pt-6 border-t border-outline-variant/20 space-y-3">
              <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
                <span className="font-label-caps text-[11px] text-on-surface-variant">Theme</span>
                <ThemeToggle />
              </div>
              <p className="font-body-sm text-[11px] text-outline">
                540 Madison Ave, New York • +1 800 450 GOLD
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
