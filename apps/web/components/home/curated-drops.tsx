'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { PublicOffer, PublicProduct } from '@repo/types';
import { OfferCountdown } from '../offers/offer-countdown';
import { catalogApi } from '../../lib/api';
import { formatPrice, getPrimaryImageUrl, getPrimarySku } from '../../lib/catalog';

interface OfferItem {
  id: string;
  name: string;
  image: string;
  href: string;
  quantity: number;
  price: number;
  isFree?: boolean;
}

interface OfferCardData {
  id: string;
  /** Used to keep the newest offers first in the carousel. */
  createdAt: string;
  eyebrow: string;
  title: string;
  badge: string;
  price: number;
  originalPrice?: number;
  priceLabel: string;
  priceNote?: string;
  images: string[];
  items: OfferItem[];
  endsAt: string | null;
  freeShipping: boolean;
  savings?: number;
}

/**
 * `Intl.NumberFormat({ style: 'ordinal' })` is not available in every runtime,
 * so build the ordinal from the plural rules of the supported locales instead.
 * Locales without a suffix convention get the plain localized number, which
 * still reads correctly in their surrounding message.
 */
function formatOrdinal(value: number, locale: string): string {
  const number = new Intl.NumberFormat(locale).format(value);
  const language = locale.toLowerCase();

  if (language.startsWith('en')) {
    const lastTwo = value % 100;
    const suffix =
      lastTwo >= 11 && lastTwo <= 13
        ? 'th'
        : value % 10 === 1
          ? 'st'
          : value % 10 === 2
            ? 'nd'
            : value % 10 === 3
              ? 'rd'
              : 'th';
    return `${number}${suffix}`;
  }

  if (language.startsWith('fr')) {
    return value === 1 ? `${number}er` : `${number}e`;
  }

  return number;
}

/** Product imagery stays recognizable whether an offer has one item or many. */
function OfferImages({
  images,
  name,
  featured,
}: {
  images: string[];
  name: string;
  featured: boolean;
}) {
  const t = useTranslations('home');
  const frame = featured
    ? 'w-full h-48 sm:h-56 rounded-lg'
    : 'w-full h-44 rounded-lg';
  const base = `${frame} bg-surface-container-low overflow-hidden relative border border-outline-variant/20 flex items-center justify-center group`;

  if (images.length === 0) {
    return (
      <div className={base}>
        <span className="material-symbols-outlined text-[40px] text-outline">local_offer</span>
      </div>
    );
  }

  const image = (src: string | undefined, index: number, className = 'w-full h-full object-cover') => (
    <img
      key={index}
      src={src ?? ''}
      alt={t('imageAlt', { name })}
      className={`${className} transform group-hover:scale-105 transition-transform duration-500`}
    />
  );

  if (images.length === 1) {
    return <div className={base}>{image(images[0], 0)}</div>;
  }

  if (images.length === 2) {
    return (
      <div className={`${base} grid grid-cols-2 gap-0.5`}>
        {images.map((src, index) => image(src, index))}
      </div>
    );
  }

  if (images.length === 3) {
    return (
      <div className={`${base} grid grid-cols-2 grid-rows-2 gap-0.5`}>
        {image(images[0], 0, 'w-full h-full object-cover row-span-2')}
        {image(images[1], 1)}
        {image(images[2], 2)}
      </div>
    );
  }

  // Packs can bundle many products: keep every product image visible in a
  // scrollable collage so the customer can recognize the whole bundle.
  return (
    <div className={`${base} grid grid-cols-2 gap-0.5 overflow-y-auto no-scrollbar`}>
      {images.map((src, index) => image(src, index, 'w-full aspect-square object-cover'))}
    </div>
  );
}

function OfferCard({
  card,
  featured,
  currency,
}: {
  card: OfferCardData;
  featured: boolean;
  currency: string;
}) {
  const t = useTranslations('home');
  const [expanded, setExpanded] = React.useState(false);
  const firstHref = card.items[0]?.href ?? null;

  return (
    <article
      className={
        featured
          ? 'min-w-[88vw] sm:min-w-[440px] md:min-w-[480px] max-w-[88vw] sm:max-w-[480px] flex-shrink-0 snap-center rounded-xl bg-surface-container-lowest border border-primary-container/40 p-4 gold-glow-subtle flex flex-col relative overflow-hidden transition-all duration-300 hover:border-primary-container'
          : 'min-w-[80vw] sm:min-w-[340px] max-w-[80vw] sm:max-w-[360px] flex-shrink-0 snap-center rounded-xl bg-surface-container-lowest border border-outline-variant/40 p-4 flex flex-col justify-between opacity-95 hover:border-primary-container/60 transition-all relative overflow-hidden'
      }
    >
      <div className="absolute -right-12 -top-12 w-36 h-36 bg-primary-container/10 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex items-center justify-between gap-2 mb-3 z-10">
        <span
          className={`inline-flex items-center space-x-1 px-2 py-0.5 border rounded font-label-caps text-[9px] font-semibold tracking-wider ${
            featured
              ? 'bg-surface border-primary-container text-primary'
              : 'bg-surface-container border-outline-variant text-secondary'
          }`}
        >
          <span className="material-symbols-outlined text-[12px]">local_offer</span>
          <span>{card.badge}</span>
        </span>
        <OfferCountdown endsAt={card.endsAt} />
      </div>

      <OfferImages
        images={card.images}
        name={card.items[0]?.name ?? card.eyebrow}
        featured={featured}
      />

      <div className="flex flex-col flex-1 justify-between z-10 mt-3.5">
        <div>
          <p className="font-label-caps text-label-caps text-primary uppercase tracking-widest mb-0.5 line-clamp-1">
            {card.eyebrow}
          </p>
          <h3
            className={`font-semibold text-on-surface leading-tight line-clamp-2 ${
              featured
                ? 'font-headline-sm text-headline-sm'
                : 'font-headline-sm text-title-md'
            }`}
          >
            {card.title}
          </h3>
          {card.savings && card.savings > 0 && (
            <span className="mt-1.5 inline-flex items-center px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-label-caps text-[9px] font-bold tracking-wider">
              {t('offers.save', { amount: formatPrice(card.savings, currency) })}
            </span>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-outline-variant/30 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="font-label-caps text-[10px] text-outline uppercase block">
              {card.priceLabel}
            </span>
            <div className="flex items-baseline space-x-2">
              <span
                className={`font-label-numeric font-bold text-on-surface ${
                  featured ? 'text-[20px]' : 'text-[17px]'
                }`}
              >
                {formatPrice(card.price, currency)}
              </span>
              {card.originalPrice && card.originalPrice > card.price && (
                <span className="font-label-numeric text-body-sm text-outline line-through">
                  {formatPrice(card.originalPrice, currency)}
                </span>
              )}
            </div>
            {card.priceNote && (
              <p className="font-body-sm text-[10px] text-secondary mt-0.5">{card.priceNote}</p>
            )}
            {card.freeShipping && (
              <p className="font-label-caps text-[9px] text-primary tracking-wider mt-0.5">
                {t('offers.shippingIncluded')}
              </p>
            )}
          </div>

          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              onClick={() => setExpanded((current) => !current)}
              className="px-2 py-2 text-secondary hover:text-primary transition-colors flex items-center"
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? t('offers.hideQuickView') : t('offers.quickView')}
            >
              <span className="material-symbols-outlined text-[16px]">
                {expanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            <Link
              href={`/offers/${encodeURIComponent(card.id)}`}
              className="px-3 py-2 border border-outline-variant/60 rounded-lg text-primary hover:bg-surface-container active:scale-95 transition-all flex items-center space-x-1 font-label-caps text-[10px] font-semibold tracking-wider"
            >
              <span>{t('offers.viewDetails')}</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-outline-variant/30 space-y-2">
            <p className="font-label-caps text-[9px] text-outline uppercase tracking-widest">
              {t('offers.included')}
            </p>
            {card.items.map((item) => (
              <div key={`${item.id}-${item.isFree ? 'free' : 'paid'}`} className="flex items-center gap-2">
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    className="w-8 h-8 rounded object-cover border border-outline-variant/30 flex-shrink-0"
                  />
                ) : (
                  <span className="w-8 h-8 rounded bg-surface-container flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[14px] text-outline">image</span>
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={item.href}
                    className="block font-body-sm text-[11px] text-on-surface truncate hover:text-primary transition-colors"
                  >
                    {item.name}
                  </Link>
                  <p className="font-label-numeric text-[10px] text-secondary">
                    {item.quantity} × {formatPrice(item.price, currency)}
                  </p>
                </div>
                {item.isFree && (
                  <span className="px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-label-caps text-[9px] font-bold">
                    {t('offers.freeUnits', { count: item.quantity })}
                  </span>
                )}
              </div>
            ))}
            {firstHref && (
              <Link
                href={firstHref}
                className="inline-flex items-center space-x-1 pt-1 font-label-caps text-[10px] text-primary hover:underline underline-offset-4"
              >
                <span>{t('offers.viewProduct')}</span>
                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function CuratedDrops() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [offers, setOffers] = React.useState<PublicOffer[]>([]);
  const [products, setProducts] = React.useState<PublicProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  /** Card offsets are measured from the viewport so padding and RTL don't matter. */
  const cardPosition = React.useCallback(
    (card: HTMLElement, container: HTMLElement) =>
      card.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft,
    []
  );

  const goToCard = React.useCallback(
    (index: number) => {
      const container = scrollRef.current;
      const card = container?.children[index];
      if (!(container instanceof HTMLElement) || !(card instanceof HTMLElement)) return;
      container.scrollTo({ left: cardPosition(card, container), behavior: 'smooth' });
      setActiveIndex(index);
    },
    [cardPosition]
  );

  const handleScroll = React.useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const children = Array.from(container.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement
    );
    if (children.length === 0) return;

    const leftEdge = container.scrollLeft;
    let nearest = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    children.forEach((card, index) => {
      // Left-edge matching keeps the last dot selected when the browser
      // clamps scrolling at the end of the strip.
      const distance = Math.abs(cardPosition(card, container) - leftEdge);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = index;
      }
    });
    setActiveIndex((current) => (current === nearest ? current : nearest));
  }, [cardPosition]);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([catalogApi.listActiveOffers(), catalogApi.listProducts()]).then(
      ([offersResult, productsResult]) => {
        if (cancelled) return;
        setOffers(offersResult.status === 'fulfilled' ? offersResult.value : []);
        setProducts(productsResult.status === 'fulfilled' ? productsResult.value : []);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const cards = React.useMemo<OfferCardData[]>(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    const toItem = (
      product: PublicProduct,
      quantity: number,
      price = product.price,
      isFree = false
    ): OfferItem => {
      const sku = getPrimarySku(product);
      return {
        id: product.id,
        name: product.name,
        image: getPrimaryImageUrl(product, sku),
        href: `/products/${encodeURIComponent(product.id)}`,
        quantity,
        price,
        isFree,
      };
    };

    const result: OfferCardData[] = [];
    for (const offer of offers) {
      if (offer.type === 'SINGLE_PRODUCT' && offer.singleRule) {
        const rule = offer.singleRule;
        const product = byId.get(rule.productId);
        if (!product) continue;

        const freeCount = rule.mode === 'BUY_X_GET_Y_FREE' ? rule.freeQuantity ?? 0 : 0;
        const received = rule.buyQuantity + freeCount;
        const isFreeShipping =
          offer.freeShipping || rule.mode === 'BUY_X_GET_FREE_SHIPPING';
        const price = isFreeShipping
          ? product.price
          : (rule.buyQuantity * product.price) / (received || 1);
        const paidTotal = rule.buyQuantity * product.price;
        const title =
          rule.mode === 'BUY_X_GET_Y_FREE'
            ? freeCount === 1
              ? t('offers.titleBuyGetOne', {
                  buy: rule.buyQuantity,
                  product: product.name,
                  ordinal: formatOrdinal(received, locale),
                })
              : t('offers.titleBuyGetMany', {
                  buy: rule.buyQuantity,
                  product: product.name,
                  free: freeCount,
                })
            : t('offers.titleFreeShipping', {
                buy: rule.buyQuantity,
                product: product.name,
              });

        result.push({
          id: offer.id,
          createdAt: offer.createdAt,
          eyebrow: offer.name,
          title,
          badge: t('offers.badgeSingle'),
          price,
          originalPrice: isFreeShipping ? undefined : product.price,
          priceLabel: isFreeShipping ? t('offers.regularPrice') : t('offers.effectivePrice'),
          priceNote: !isFreeShipping
            ? t('offers.payFor', { buy: rule.buyQuantity, total: received, amount: formatPrice(paidTotal, tCommon('currency')) })
            : undefined,
          images: [toItem(product, rule.buyQuantity).image],
          items: [
            toItem(product, rule.buyQuantity),
            ...(freeCount > 0 ? [toItem(product, freeCount, 0, true)] : []),
          ],
          endsAt: offer.endsAt,
          freeShipping: isFreeShipping,
          savings: isFreeShipping ? undefined : freeCount * product.price,
        });
        continue;
      }

      if (offer.type === 'PACK' && offer.packItems.length > 0) {
        const items = offer.packItems.flatMap((packItem) => {
          const product = byId.get(packItem.productId);
          return product ? [toItem(product, packItem.quantity)] : [];
        });
        if (items.length === 0) continue;

        const regularTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const price = offer.packPrice ?? regularTotal;
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

        result.push({
          id: offer.id,
          createdAt: offer.createdAt,
          eyebrow: offer.name,
          title: t('offers.titlePack', {
            product: [...new Set(items.map((item) => item.name))].join(', '),
            count: totalQuantity,
          }),
          badge: t('offers.badgePack'),
          price,
          originalPrice: regularTotal,
          priceLabel: t('offers.packPrice'),
          priceNote: t('offers.packNote', { count: totalQuantity }),
          images: [...new Set(items.map((item) => item.image))].filter(Boolean),
          items,
          endsAt: offer.endsAt,
          freeShipping: false,
          savings: regularTotal - price,
        });
      }
    }
    // Newest offers first so a freshly created promotion is immediately visible.
    return result.sort((a, b) => {
      const left = new Date(a.createdAt).getTime();
      const right = new Date(b.createdAt).getTime();
      return (Number.isNaN(right) ? 0 : right) - (Number.isNaN(left) ? 0 : left);
    });
  }, [offers, products, t, tCommon, locale]);

  React.useEffect(() => {
    setActiveIndex(0);
    scrollRef.current?.scrollTo({ left: 0 });
  }, [cards]);

  const currency = tCommon('currency');

  // Keep the original three-dot indicator: a small window that follows the
  // active offer instead of one dot per offer.
  const dotCount = Math.min(3, cards.length);
  const dotStart = Math.min(Math.max(activeIndex - 1, 0), Math.max(0, cards.length - dotCount));
  const visibleDots = Array.from({ length: dotCount }, (_, offset) => dotStart + offset);

  return (
    <section className="w-full px-margin overflow-hidden max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-3.5 bg-primary-container rounded-full"></span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {t('curatedDrops')}
          </h2>
        </div>
        {!loading && cards.length > 0 && (
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => goToCard(Math.max(0, activeIndex - 1))}
              disabled={activeIndex === 0}
              aria-label={t('offers.previous')}
              className="w-6 h-6 rounded-full border border-outline-variant/60 flex items-center justify-center text-primary disabled:opacity-30 hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">chevron_left</span>
            </button>
            <div className="flex items-center space-x-1">
              {visibleDots.map((index) => (
                <button
                  key={cards[index]?.id ?? index}
                  type="button"
                  onClick={() => goToCard(index)}
                  aria-label={t('offers.goTo', { index: index + 1 })}
                  aria-current={activeIndex === index}
                  className={`h-1 rounded-full transition-all duration-200 cursor-pointer ${
                    activeIndex === index
                      ? 'w-4 bg-primary'
                      : 'w-1.5 bg-outline-variant hover:bg-primary/50'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => goToCard(Math.min(cards.length - 1, activeIndex + 1))}
              disabled={activeIndex >= cards.length - 1}
              aria-label={t('offers.next')}
              className="w-6 h-6 rounded-full border border-outline-variant/60 flex items-center justify-center text-primary disabled:opacity-30 hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex space-x-4 overflow-x-auto no-scrollbar py-2 -mx-margin px-margin">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="min-w-[80vw] sm:min-w-[360px] max-w-[88vw] sm:max-w-[480px] flex-shrink-0 rounded-xl bg-surface-container-low animate-pulse space-y-3 p-4"
            >
              <div className="h-5 w-24 rounded bg-surface-container" />
              <div className="h-48 rounded-lg bg-surface-container-lowest" />
              <div className="h-5 w-3/4 rounded bg-surface-container" />
              <div className="h-4 w-1/2 rounded bg-surface-container" />
            </div>
          ))}
          <p className="sr-only">{t('offers.loading')}</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest subtle-hairline p-8 text-center">
          <span className="material-symbols-outlined text-[32px] text-outline">
            local_offer
          </span>
          <p className="font-body-sm text-secondary mt-2">{t('offers.empty')}</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex space-x-4 overflow-x-auto no-scrollbar py-2 -mx-margin px-margin snap-x snap-mandatory"
        >
          {cards.map((card, index) => (
            <OfferCard
              key={card.id}
              card={card}
              featured={index === 0}
              currency={currency}
            />
          ))}
        </div>
      )}
    </section>
  );
}
