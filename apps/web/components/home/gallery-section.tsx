'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { GalleryState, PublicGalleryPhoto } from '@repo/types';
import { catalogApi } from '../../lib/api';
import { resolveMediaUrl } from '../../lib/catalog';

const PHOTOS_PER_PAGE = 3;

function chunkPhotos(photos: PublicGalleryPhoto[], size: number): PublicGalleryPhoto[][] {
  const pages: PublicGalleryPhoto[][] = [];
  for (let index = 0; index < photos.length; index += size) {
    pages.push(photos.slice(index, index + size));
  }
  return pages;
}

/**
 * Home-page photo gallery. The dashboard controls visibility and the photos;
 * this component renders nothing while the section is inactive or empty.
 */
export function GallerySection() {
  const t = useTranslations('home.gallery');
  const locale = useLocale();
  const [state, setState] = React.useState<GalleryState | null>(null);
  const [activePage, setActivePage] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    void catalogApi
      .getGallery()
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        // The gallery is decorative: an API failure simply hides the section.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pages = React.useMemo(
    () => chunkPhotos(state?.photos ?? [], PHOTOS_PER_PAGE),
    [state]
  );

  /** Same slide-position logic as the other home carousels; RTL-safe. */
  const pagePosition = React.useCallback(
    (page: HTMLElement, container: HTMLElement) =>
      page.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft,
    []
  );

  const goToPage = React.useCallback(
    (index: number) => {
      const container = scrollRef.current;
      const page = container?.children[index];
      if (!(container instanceof HTMLElement) || !(page instanceof HTMLElement)) return;
      container.scrollTo({ left: pagePosition(page, container), behavior: 'smooth' });
      setActivePage(index);
    },
    [pagePosition]
  );

  const handleScroll = React.useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const pageElements = Array.from(container.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement
    );
    if (pageElements.length === 0) return;

    const leftEdge = container.scrollLeft;
    let nearest = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    pageElements.forEach((page, index) => {
      const distance = Math.abs(pagePosition(page, container) - leftEdge);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = index;
      }
    });
    setActivePage((current) => (current === nearest ? current : nearest));
  }, [pagePosition]);

  React.useEffect(() => {
    if (activePage >= pages.length) setActivePage(0);
  }, [pages.length, activePage]);

  const dotCount = Math.min(3, pages.length);
  const dotStart = Math.min(Math.max(activePage - 1, 0), Math.max(0, pages.length - dotCount));
  const visibleDots = Array.from({ length: dotCount }, (_, offset) => dotStart + offset);

  if (!state?.isActive || pages.length === 0) return null;

  const formatDate = (value: string): string =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));

  return (
    <section className="w-full px-margin max-w-7xl mx-auto">
      <div className="p-5 sm:p-7 rounded-2xl bg-surface-container-low/60 border border-outline-variant/40 relative overflow-hidden">
        <div className="mb-4">
          <span className="font-label-caps text-label-caps text-primary tracking-widest block uppercase">
            {t('badge')}
          </span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{t('title')}</h2>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory"
        >
          {pages.map((page, pageIndex) => (
            <div key={pageIndex} className="w-full flex-shrink-0 snap-center">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {page.map((photo) => (
                  <figure
                    key={photo.id}
                    className="rounded-xl overflow-hidden bg-surface-container-lowest border border-outline-variant/40 h-full"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-surface-container">
                      <img
                        src={resolveMediaUrl(photo.image)}
                        alt={t('imageAlt', { name: photo.name, location: photo.location })}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <figcaption className="p-3">
                      <h3 className="font-title-md text-[14px] font-semibold text-on-surface leading-tight">
                        {photo.name}
                      </h3>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="font-body-sm text-[11px] text-secondary flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">place</span>
                          {photo.location}
                        </span>
                        <time className="font-label-numeric text-[11px] text-outline" dateTime={photo.date}>
                          {formatDate(photo.date)}
                        </time>
                      </div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </div>

        {pages.length > 1 ? (
          <div className="flex justify-center items-center space-x-2 mt-4">
            <button
              type="button"
              onClick={() => goToPage(Math.max(0, activePage - 1))}
              disabled={activePage === 0}
              aria-label={t('previous')}
              className="w-6 h-6 rounded-full border border-outline-variant/60 flex items-center justify-center text-primary disabled:opacity-30 hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">chevron_left</span>
            </button>
            {visibleDots.map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => goToPage(index)}
                aria-label={t('goTo', { index: index + 1 })}
                aria-current={activePage === index}
                className={`h-1 rounded-full transition-all duration-200 cursor-pointer ${
                  activePage === index
                    ? 'w-4 bg-primary'
                    : 'w-1.5 bg-outline-variant hover:bg-primary/50'
                }`}
              />
            ))}
            <button
              type="button"
              onClick={() => goToPage(Math.min(pages.length - 1, activePage + 1))}
              disabled={activePage >= pages.length - 1}
              aria-label={t('next')}
              className="w-6 h-6 rounded-full border border-outline-variant/60 flex items-center justify-center text-primary disabled:opacity-30 hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
