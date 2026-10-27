'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

export function ClientAppraisals() {
  const t = useTranslations('home.appraisals');

  return (
    <section className="w-full px-margin max-w-7xl mx-auto">
      <div className="p-5 sm:p-7 rounded-2xl bg-surface-container-low/60 border border-outline-variant/40 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="font-label-caps text-label-caps text-primary tracking-widest block uppercase">
              {t('badge')}
            </span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">{t('title')}</h2>
          </div>
          {/* 5-Star Indicator */}
          <div className="flex text-primary">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                star
              </span>
            ))}
          </div>
        </div>

        {/* Quote Block Card */}
        <div className="p-4 sm:p-6 rounded-xl bg-surface-container-lowest border border-primary-container/30 shadow-sm relative">
          <span className="material-symbols-outlined text-primary-container/20 text-[48px] absolute right-4 top-3 pointer-events-none select-none">
            format_quote
          </span>
          <div className="flex items-center space-x-2 mb-3">
            <span className="px-2 py-0.5 rounded bg-surface border border-primary-container/60 text-primary font-label-caps text-[10px] flex items-center space-x-1">
              <span
                className="material-symbols-outlined text-[13px] text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
              <span>{t('collector')}</span>
            </span>
            <span className="font-label-numeric text-[11px] text-outline">{t('location')}</span>
          </div>

          <p className="font-body-md text-on-surface italic leading-relaxed text-[15px] max-w-3xl">
            {t('quote')}
          </p>

          {/* Reviewer Info */}
          <div className="mt-4 pt-3 border-t border-outline-variant/30 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full border border-primary-container overflow-hidden bg-surface-container">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB5EsaFjMWaLDALTtfOdEpsU7C6DGBU-gZio_8KGXkmR4zntXoutKxc8u1hFYhrYDh20v3Mxn8DhccWaJqtNFxdBnNvi2OGzi7ceLb6eJkCKssUg3pcdqRas8RqNsRs8_82LR8qEwFXcD2lg3CfAGP6McxeSShvwgz3T0mrySfRf8yHAoINQTG--xN4ZFB8w96sxF8VclaBRqm-QGpfIreR8KDxX6QySxfzHUUrV9i4MiNEBqh9d6ClKA"
                alt="Julian Vance Portrait"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h4 className="font-title-md text-[14px] text-on-surface font-semibold leading-tight">
                {t('author')}
              </h4>
              <p className="font-label-caps text-[10px] text-primary tracking-wider uppercase mt-0.5">
                {t('role')}
              </p>
            </div>
          </div>
        </div>

        {/* Swiper Dots */}
        <div className="flex justify-center items-center space-x-2 mt-4">
          <span className="w-6 h-1 bg-primary rounded-full"></span>
          <span className="w-1.5 h-1 bg-outline-variant rounded-full"></span>
          <span className="w-1.5 h-1 bg-outline-variant rounded-full"></span>
        </div>
      </div>
    </section>
  );
}
