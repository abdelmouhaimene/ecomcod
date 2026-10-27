'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('home.footer');
  const tCommon = useTranslations('common');

  return (
    <footer className="w-full bg-surface-container-low dark:bg-inverse-surface border-t border-outline-variant/30 pt-8 pb-16">
      <div className="w-full px-margin max-w-7xl mx-auto flex flex-col space-y-7">
        {/* Atelier Brand Details */}
        <div>
          <span className="font-label-caps text-label-caps text-primary dark:text-inverse-primary tracking-widest font-bold">
            {tCommon('brandName')}
          </span>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 max-w-md">
            {t('about')}
          </p>
        </div>

        {/* Physical Flagship & Care Contact */}
        <div className="p-4 rounded-xl bg-surface-container-lowest dark:bg-on-surface/10 border border-outline-variant/30 space-y-3">
          <div className="flex items-start space-x-2.5">
            <span className="material-symbols-outlined text-[20px] text-primary mt-0.5">
              storefront
            </span>
            <div>
              <p className="font-label-caps text-[10px] uppercase text-outline tracking-wider">
                {t('boutique')}
              </p>
              <p className="font-body-sm text-body-sm font-medium text-on-surface">
                {t('boutiqueAddress')}
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-2.5">
            <span className="material-symbols-outlined text-[20px] text-primary mt-0.5">
              support_agent
            </span>
            <div>
              <p className="font-label-caps text-[10px] uppercase text-outline tracking-wider">
                {t('concierge')}
              </p>
              <p className="font-body-sm text-body-sm text-on-surface font-medium">
                {t('conciergePhone')}
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px]">
                {t('conciergeEmail')}
              </p>
              <p className="font-label-caps text-[10px] text-outline mt-0.5">
                {t('conciergeHours')}
              </p>
            </div>
          </div>
        </div>

        {/* Curated Links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2.5 gap-x-4">
          <a
            className="font-body-sm text-body-sm text-on-surface-variant dark:text-secondary-fixed-dim hover:text-primary transition-colors duration-150"
            href="#"
          >
            {t('links.stores')}
          </a>
          <a
            className="font-body-sm text-body-sm text-on-surface-variant dark:text-secondary-fixed-dim hover:text-primary transition-colors duration-150"
            href="#"
          >
            {t('links.support')}
          </a>
          <a
            className="font-body-sm text-body-sm text-on-surface-variant dark:text-secondary-fixed-dim hover:text-primary transition-colors duration-150"
            href="#"
          >
            {t('links.warranty')}
          </a>
          <a
            className="font-body-sm text-body-sm text-on-surface-variant dark:text-secondary-fixed-dim hover:text-primary transition-colors duration-150"
            href="#"
          >
            {t('links.auth')}
          </a>
          <a
            className="font-body-sm text-body-sm text-on-surface-variant dark:text-secondary-fixed-dim hover:text-primary transition-colors duration-150"
            href="#"
          >
            {t('links.privacy')}
          </a>
          <a
            className="font-body-sm text-body-sm text-on-surface-variant dark:text-secondary-fixed-dim hover:text-primary transition-colors duration-150"
            href="#"
          >
            {t('links.terms')}
          </a>
        </div>

        {/* Copyright */}
        <div className="pt-4 border-t border-outline-variant/30 flex flex-col space-y-2">
          <p className="font-body-sm text-[12px] text-outline">{t('copyright')}</p>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
            <span className="font-label-caps text-[10px] text-on-surface-variant">
              {t('isoBadge')}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
