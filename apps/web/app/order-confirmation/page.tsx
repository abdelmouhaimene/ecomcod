'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function OrderConfirmationPage() {
  const t = useTranslations('tracking');
  const tCommon = useTranslations('common');

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col font-body-md text-body-md pb-16">
      {/* Top Header */}
      <header className="docked full-width top-0 sticky z-50 bg-surface/85 dark:bg-inverse-surface/90 backdrop-blur-md border-b border-outline-variant/30 shadow-sm">
        <div className="flex items-center justify-between px-margin py-space-sm max-w-lg mx-auto w-full">
          <Link
            href="/"
            className="flex items-center justify-center p-1 text-on-surface hover:text-primary transition-colors duration-150 active:scale-95"
            aria-label="Return to boutique home"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </Link>

          <div className="flex flex-col items-center">
            <span className="font-label-caps text-label-caps tracking-widest text-primary font-bold">
              {tCommon('brandName')}
            </span>
            <span className="font-label-caps text-[9px] tracking-widest text-secondary font-medium -mt-0.5">
              {t('vaultBadge')}
            </span>
          </div>

          <a
            href="tel:+18004504653"
            className="flex items-center justify-center p-1 text-primary hover:text-primary-container transition-colors duration-150 active:scale-95"
            aria-label="Call concierge"
          >
            <span className="material-symbols-outlined text-[20px]">support_agent</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-lg mx-auto px-margin flex-grow pt-4 space-y-6">
        {/* 1. CONFIRMATION HERO & AUTHENTIC SEAL */}
        <section className="text-center pt-2 pb-2 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-surface-container-lowest border-2 border-primary-container/60 p-1 flex items-center justify-center gold-bloom mb-3">
            <div className="w-full h-full rounded-full bg-primary flex items-center justify-center text-on-primary">
              <span
                className="material-symbols-outlined text-[28px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
            </div>
          </div>

          <span className="font-label-caps text-[10px] tracking-widest text-primary font-bold uppercase mb-1">
            {t('orderNumber')}
          </span>
          <h1 className="font-headline-sm text-headline-sm font-bold text-on-surface">
            {t('orderConfirmed')}
          </h1>
          <p className="font-body-sm text-[13px] text-secondary mt-1 max-w-xs">
            {t('orderSubtitle')}
          </p>
        </section>

        {/* 2. ESTIMATED DELIVERY CARD */}
        <section className="p-4 rounded-xl bg-surface-container-lowest subtle-hairline gold-bloom space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-label-caps text-[10px] text-outline uppercase tracking-wider font-semibold">
              {t('estimatedDelivery')}
            </span>
            <span className="px-2 py-0.5 rounded bg-surface border border-primary-container text-primary font-label-caps text-[9px] font-bold">
              PRIORITY VAULT
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="font-headline-sm text-[20px] font-bold text-on-surface">
              {t('deliveryTime')}
            </span>
          </div>
          <p className="font-body-sm text-[12px] text-secondary">
            Recipient: 540 Madison Ave, Penthouse Suite, New York, NY
          </p>
        </section>

        {/* 3. DISPATCH TIMELINE TRACKER */}
        <section className="space-y-3">
          <h3 className="font-label-caps text-[11px] text-primary uppercase tracking-widest font-bold">
            Live Dispatch Protocol
          </h3>

          <div className="bg-surface-container-lowest rounded-xl p-4 subtle-hairline space-y-4">
            {/* Step 1: Sealed */}
            <div className="flex items-start space-x-3 relative">
              <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center flex-shrink-0 z-10 text-[14px]">
                <span className="material-symbols-outlined text-[16px]">check</span>
              </div>
              <div className="absolute left-3.5 top-7 w-0.5 h-10 bg-primary/40 pointer-events-none" />
              <div>
                <h4 className="font-title-md text-[13px] font-semibold text-on-surface">
                  {t('timeline.step1')}
                </h4>
                <p className="font-body-sm text-[11px] text-secondary">
                  {t('timeline.step1Desc')}
                </p>
                <span className="font-label-numeric text-[10px] text-primary block mt-0.5">
                  14:20 EST • Completed
                </span>
              </div>
            </div>

            {/* Step 2: Assembly */}
            <div className="flex items-start space-x-3 relative">
              <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center flex-shrink-0 z-10 text-[14px]">
                <span className="material-symbols-outlined text-[16px]">check</span>
              </div>
              <div className="absolute left-3.5 top-7 w-0.5 h-10 bg-primary/40 pointer-events-none" />
              <div>
                <h4 className="font-title-md text-[13px] font-semibold text-on-surface">
                  {t('timeline.step2')}
                </h4>
                <p className="font-body-sm text-[11px] text-secondary">
                  {t('timeline.step2Desc')}
                </p>
                <span className="font-label-numeric text-[10px] text-primary block mt-0.5">
                  15:05 EST • Completed
                </span>
              </div>
            </div>

            {/* Step 3: Vault Dispatch (Active) */}
            <div className="flex items-start space-x-3 relative">
              <div className="w-7 h-7 rounded-full bg-surface-container border-2 border-primary-container text-primary flex items-center justify-center flex-shrink-0 z-10 text-[14px] gold-glow-subtle animate-pulse">
                <span className="material-symbols-outlined text-[16px]">local_shipping</span>
              </div>
              <div className="absolute left-3.5 top-7 w-0.5 h-10 bg-outline-variant/30 pointer-events-none" />
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-title-md text-[13px] font-semibold text-primary">
                    {t('timeline.step3')}
                  </h4>
                  <span className="px-1.5 py-0.2 bg-primary-fixed text-on-primary-fixed rounded font-label-caps text-[9px] font-bold">
                    IN TRANSIT
                  </span>
                </div>
                <p className="font-body-sm text-[11px] text-secondary">
                  {t('timeline.step3Desc')}
                </p>
                <span className="font-label-numeric text-[10px] text-outline block mt-0.5">
                  Departed Atelier Vault JFK
                </span>
              </div>
            </div>

            {/* Step 4: White-Glove Handover */}
            <div className="flex items-start space-x-3">
              <div className="w-7 h-7 rounded-full bg-surface-container-low text-outline flex items-center justify-center flex-shrink-0 z-10 text-[14px]">
                <span className="material-symbols-outlined text-[16px]">person</span>
              </div>
              <div>
                <h4 className="font-title-md text-[13px] font-semibold text-outline">
                  {t('timeline.step4')}
                </h4>
                <p className="font-body-sm text-[11px] text-secondary">
                  {t('timeline.step4Desc')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. COURIER CARD & MAP VISUAL */}
        <section className="bg-surface-container-lowest rounded-xl p-4 subtle-hairline space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="material-symbols-outlined text-primary text-[22px]">security</span>
              <div>
                <h4 className="font-title-md text-[13px] font-semibold text-on-surface">
                  {t('courierName')}
                </h4>
                <p className="font-label-caps text-[10px] text-secondary">{t('trackingId')}</p>
              </div>
            </div>
            <a
              href="tel:+18004504653"
              className="p-1.5 rounded-lg border border-primary-container text-primary hover:bg-surface-container-low transition-colors text-xs flex items-center space-x-1"
            >
              <span className="material-symbols-outlined text-[16px]">phone</span>
              <span className="font-label-caps text-[10px]">Courier</span>
            </a>
          </div>

          {/* Aesthetic Schematic Map Preview */}
          <div className="w-full h-32 rounded-lg bg-surface-container-low border border-outline-variant/30 overflow-hidden relative flex items-center justify-center">
            {/* Dark/Light mode adaptive map simulation */}
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#c5a059_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="relative z-10 flex flex-col items-center space-y-1">
              <span className="w-3 h-3 rounded-full bg-primary animate-ping" />
              <span className="px-2 py-0.5 rounded bg-on-surface text-surface-container-lowest font-label-caps text-[9px] tracking-wider font-semibold shadow-md">
                En Route: Madison Corridor
              </span>
            </div>
          </div>
        </section>

        {/* 5. ACTION BUTTONS */}
        <section className="space-y-2 pt-2">
          <Link
            href="/"
            className="w-full py-3 px-4 rounded-lg bg-on-surface text-surface-container-lowest border border-primary-container/60 font-label-caps text-[11px] font-bold tracking-wider flex items-center justify-center space-x-2 gold-glow-interactive active:scale-95 transition-all hover:bg-primary"
          >
            <span>{t('returnHome')}</span>
            <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">
              storefront
            </span>
          </Link>

          <a
            href="tel:+18004504653"
            className="w-full py-3 px-4 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container-low font-label-caps text-[11px] font-semibold tracking-wider flex items-center justify-center space-x-2 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">
              support_agent
            </span>
            <span>{t('contactConcierge')}</span>
          </a>
        </section>
      </main>
    </div>
  );
}
