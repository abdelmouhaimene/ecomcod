'use client';

import { useTranslations } from 'next-intl';
import { useStoreInfo } from '../../context/store-info-context';

/**
 * Optional home-page YouTube section. The dashboard owns both the visibility
 * flag and the link; this component renders nothing while either is missing.
 */
export function FeaturedVideoSection() {
  const t = useTranslations('home.video');
  const { store } = useStoreInfo();

  if (!store?.homeVideoEnabled || !store.homeVideoEmbedUrl) return null;

  return (
    <section className="w-full px-margin max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-low/60 p-2 sm:p-3 gold-glow-subtle">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-16 bg-gradient-to-br from-primary/10 via-transparent to-tertiary/10 blur-2xl"
        />
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
          <iframe
            className="absolute inset-0 h-full w-full"
            src={store.homeVideoEmbedUrl}
            title={t('embedTitle')}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </section>
  );
}
