'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useStoreInfo } from '../../context/store-info-context';
import { resolveMediaUrl } from '../../lib/catalog';
import { SocialLinks } from './social-links';

export function Footer() {
  const t = useTranslations('home.footer');
  const tCommon = useTranslations('common');
  const tStore = useTranslations('store');
  const { store } = useStoreInfo();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-surface-container-low dark:bg-inverse-surface border-t border-outline-variant/30 pt-8 pb-16">
      <div className="w-full px-margin max-w-7xl mx-auto flex flex-col space-y-6">
        <section
          id="store-info"
          className="grid gap-5 rounded-xl bg-surface-container-lowest dark:bg-on-surface/10 border border-outline-variant/30 p-5 md:grid-cols-3 scroll-mt-24"
        >
          {/* Store details and links, managed from the dashboard */}
          <div className="md:col-span-2 flex flex-col space-y-5">
            <div className="flex items-start gap-4">
              {store?.logo ? (
                <img
                  src={resolveMediaUrl(store.logo)}
                  alt={store.name}
                  className="h-14 w-14 shrink-0 rounded-lg border border-outline-variant/40 bg-surface-container-lowest object-contain p-1.5"
                />
              ) : null}
              <div className="min-w-0">
                <span className="font-label-caps text-label-caps text-primary dark:text-inverse-primary tracking-widest font-bold">
                  {store?.name || tCommon('brandName')}
                </span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 max-w-md">
                  {store?.description || t('about')}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start space-x-2.5">
                <span className="material-symbols-outlined text-[20px] text-primary mt-0.5">
                  storefront
                </span>
                <div>
                  <p className="font-label-caps text-[10px] uppercase text-outline tracking-wider">
                    {t('boutique')}
                  </p>
                  <p className="font-body-sm text-body-sm font-medium text-on-surface">
                    {store?.address || t('boutiqueAddress')}
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
                  {store?.phones.length ? (
                    store.phones.map((phone) => (
                      <a
                        key={phone.id}
                        href={`tel:${phone.number.replace(/[^\d+]/g, '')}`}
                        className="block font-body-sm text-body-sm text-on-surface font-medium hover:underline"
                      >
                        {phone.number}
                      </a>
                    ))
                  ) : (
                    <p className="font-body-sm text-body-sm text-on-surface font-medium">
                      {t('conciergePhone')}
                    </p>
                  )}
                  <a
                    href={`mailto:${store?.email || t('conciergeEmail')}`}
                    className="block font-body-sm text-body-sm text-on-surface-variant text-[12px] hover:underline"
                  >
                    {store?.email || t('conciergeEmail')}
                  </a>
                </div>
              </div>
            </div>

            {/* Links sit below the phone numbers and email */}
            <div className="border-t border-outline-variant/30 pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2.5 gap-x-4">
                <a
                  className="font-body-sm text-body-sm text-on-surface-variant dark:text-secondary-fixed-dim hover:text-primary transition-colors duration-150"
                  href="#"
                >
                  {t('links.policy')}
                </a>
                <a
                  className="font-body-sm text-body-sm text-on-surface-variant dark:text-secondary-fixed-dim hover:text-primary transition-colors duration-150"
                  href="#"
                >
                  {t('links.faq')}
                </a>
                <a
                  className="font-body-sm text-body-sm text-on-surface-variant dark:text-secondary-fixed-dim hover:text-primary transition-colors duration-150"
                  href="#"
                >
                  {t('links.shippingReturn')}
                </a>
              </div>
            </div>

            {store?.website || store?.socialLinks.length ? (
              <div className="flex flex-wrap items-center gap-4 border-t border-outline-variant/30 pt-4">
                {store?.website ? (
                  <a
                    href={/^https?:\/\//i.test(store.website) ? store.website : `https://${store.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-[16px]">public</span>
                    {store.website}
                  </a>
                ) : null}
                {store ? <SocialLinks links={store.socialLinks} /> : null}
              </div>
            ) : null}
          </div>

          {/* Map on the right side of the footer */}
          <div className="flex flex-col space-y-3 md:border-l md:border-outline-variant/30 md:pl-5">
            <div className="flex items-center space-x-2.5">
              <span className="material-symbols-outlined text-[20px] text-primary">map</span>
              <p className="font-label-caps text-[10px] uppercase text-outline tracking-wider">
                {tStore('locationTitle')}
              </p>
            </div>
            <div className="min-h-[12rem] flex-1">
              {store?.mapEmbedUrl ? (
                <iframe
                  src={store.mapEmbedUrl}
                  title={tStore('mapAlt', {
                    name: store.name || tCommon('brandName'),
                  })}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-48 w-full rounded-lg border border-outline-variant/40 bg-surface-container-low md:h-full"
                />
              ) : (
                <div className="flex h-48 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-outline-variant bg-surface-container-low text-center md:h-full">
                  <span className="material-symbols-outlined text-[28px] text-outline">pin_drop</span>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {tStore('noMap')}
                  </p>
                </div>
              )}
            </div>
            {store?.mapLink ? (
              <a
                href={store.mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-body-sm text-body-sm text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                {tStore('openMap')}
              </a>
            ) : null}
          </div>
        </section>

        {/* Copyright */}
        <div className="pt-4 border-t border-outline-variant/30">
          <p className="font-body-sm text-[12px] text-outline">
            {t('copyright', {
              year: currentYear,
              name: store?.name || tCommon('brandName'),
            })}
          </p>
        </div>
      </div>
    </footer>
  );
}
