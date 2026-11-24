'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type {
  PublicOffer,
  PublicProduct,
  PublicProductVariantValue,
} from '@repo/types';
import { useStore } from '../../../context/store-context';
import { catalogApi } from '../../../lib/api';
import {
  formatPrice,
  getPrimaryImageUrl,
  getPrimarySku,
  getRating,
  getSalesCount,
  resolveMediaUrl,
  slugify,
} from '../../../lib/catalog';
import {
  VARIANT_LABEL_KEYS,
  buildVariantGroups,
  buildVariantOptions,
  canSelectVariant,
  findSelectedSku,
  initialVariantSelection,
  selectedVariantIds,
} from '../../../lib/variants';

interface GalleryImage {
  id: string;
  url: string;
}

async function findProduct(slug: string): Promise<PublicProduct | null> {
  let decodedSlug = slug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    // Keep the raw slug if it is not valid percent-encoding.
  }

  try {
    return await catalogApi.getProduct(decodedSlug);
  } catch {
    // Legacy links use names (e.g. `aura-pro-studio`) instead of database ids.
  }

  try {
    const products = await catalogApi.listProducts();
    const candidates = [decodedSlug, slug, slugify(decodedSlug)];
    return (
      products.find((product) => {
        const identifiers = [
          product.id,
          product.ref,
          slugify(product.name),
        ].filter((value) => value.length > 0);
        return identifiers.some((identifier) =>
          candidates.some(
            (candidate) =>
              candidate.length > 0 &&
              (identifier.toLowerCase() === candidate.toLowerCase() ||
                slugify(identifier).toLowerCase() === slugify(candidate).toLowerCase())
          )
        );
      }) ?? null
    );
  } catch {
    return null;
  }
}

export function ProductDetailsSkeleton() {
  const t = useTranslations('product');

  return (
    <div className="w-full min-h-screen bg-background text-on-surface antialiased pb-32">
      <div className="max-w-md md:max-w-4xl mx-auto px-margin pt-6 space-y-6 animate-pulse">
        <div className="h-4 w-24 rounded bg-surface-container" />
        <div className="md:grid md:grid-cols-2 md:gap-8 md:space-y-0 space-y-6">
          <div className="aspect-square rounded-xl bg-surface-container-low" />
          <div className="space-y-4 pt-2">
            <div className="h-3 w-28 rounded bg-primary/30" />
            <div className="h-8 w-4/5 rounded bg-surface-container" />
            <div className="h-4 w-2/3 rounded bg-surface-container" />
            <div className="h-24 rounded-xl bg-surface-container-low" />
            <div className="h-16 rounded-xl bg-surface-container-low" />
          </div>
        </div>
        <p className="font-body-sm text-secondary text-center">{t('loading')}</p>
      </div>
    </div>
  );
}

export default function ProductDetails() {
  const t = useTranslations('product');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] ?? '' : params.slug ?? '';
  const { addToCart, isWishlisted, toggleWishlist } = useStore();

  const [product, setProduct] = React.useState<PublicProduct | null>(null);
  const [products, setProducts] = React.useState<PublicProduct[]>([]);
  const [offers, setOffers] = React.useState<PublicOffer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [selectedValueIds, setSelectedValueIds] = React.useState<Record<string, string>>(
    {}
  );
  const [addedToast, setAddedToast] = React.useState(false);

  const currency = tCommon('currency');

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const [productResult, offersResult, productsResult] = await Promise.allSettled([
        findProduct(slug),
        catalogApi.listActiveOffers(),
        catalogApi.listProducts(),
      ]);
      if (cancelled) return;

      setProduct(productResult.status === 'fulfilled' ? productResult.value : null);
      setOffers(offersResult.status === 'fulfilled' ? offersResult.value : []);
      setProducts(productsResult.status === 'fulfilled' ? productsResult.value : []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const groups = React.useMemo(
    () => (product ? buildVariantGroups(product) : []),
    [product]
  );
  const valueById = React.useMemo(
    () =>
      new Map(
        (product?.variants ?? [])
          .flatMap((variant) => variant.values)
          .map((value) => [value.id, value])
      ),
    [product]
  );
  const selectedIds = React.useMemo(
    () => selectedVariantIds(selectedValueIds),
    [selectedValueIds]
  );
  const selectedSku = React.useMemo(
    () => (product ? findSelectedSku(product, selectedValueIds) : null),
    [product, selectedValueIds]
  );
  const selectedValue = selectedIds
    .map((id) => valueById.get(id))
    .find((value): value is PublicProductVariantValue => Boolean(value));

  React.useEffect(() => {
    setActiveImageIndex(0);
    if (!product) {
      setSelectedValueIds({});
      return;
    }
    setSelectedValueIds(initialVariantSelection(product, groups));
  }, [groups, product]);

  React.useEffect(() => {
    if (!addedToast) return;
    const timer = window.setTimeout(() => setAddedToast(false), 2500);
    return () => window.clearTimeout(timer);
  }, [addedToast]);

  const galleryImages = React.useMemo<GalleryImage[]>(() => {
    if (!product) return [];
    const sorted = [...product.images].sort((a, b) => a.position - b.position);
    const images = sorted.map((image) => ({ id: image.id, url: image.url }));
    const preferredUrl = selectedSku?.imageUrl || selectedValue?.imageUrl;
    if (!preferredUrl) return images;

    const index = images.findIndex((image) => image.url === preferredUrl);
    if (index === -1) {
      return [
        { id: `selected-${selectedSku?.id ?? selectedValue?.id ?? 'image'}`, url: preferredUrl },
        ...images,
      ];
    }
    const preferred = images[index];
    return preferred
      ? [preferred, ...images.filter((_, imageIndex) => imageIndex !== index)]
      : images;
  }, [product, selectedSku, selectedValue]);

  const applicableOffers = React.useMemo(
    () =>
      offers.filter((offer) => {
        const rule = offer.singleRule;
        if (!rule || !product) return false;
        return rule.productId === product.id;
      }),
    [offers, product]
  );

  const relatedProducts = React.useMemo(() => {
    if (!product || product.families.length === 0) return [];
    const familyIds = new Set(product.families.map((family) => family.id));

    return products
      .filter((candidate) => candidate.id !== product.id)
      .map((candidate) => ({
        product: candidate,
        sharedFamilies: candidate.families.filter((family) => familyIds.has(family.id)),
      }))
      .filter((entry) => entry.sharedFamilies.length > 0)
      .sort(
        (a, b) =>
          b.sharedFamilies.length - a.sharedFamilies.length ||
          a.product.name.localeCompare(b.product.name)
      )
      .slice(0, 8);
  }, [product, products]);

  const rating = product ? getRating(product) : null;
  const salesCount = product ? getSalesCount(product) : 0;
  const categoryLabel =
    product?.categories
      .map((category) => category.name.trim())
      .filter(Boolean)
      .join(', ') ?? '';
  const discountPercent =
    product && product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;
  const activeImage = galleryImages[activeImageIndex] ?? galleryImages[0];
  const wishlisted = product ? isWishlisted(product.id) : false;

  const canSelectOption = (groupKey: string, valueId: string): boolean =>
    product
      ? canSelectVariant(product, selectedValueIds, groupKey, valueId)
      : false;

  const selectValue = (groupKey: string, valueId: string) => {
    setSelectedValueIds((prev) => ({ ...prev, [groupKey]: valueId }));
    setActiveImageIndex(0);
  };

  const handleAddToBag = () => {
    if (!product || !selectedSku) return;
    addToCart({
      skuId: selectedSku.id,
      productId: product.id,
      name: product.name,
      sku: selectedSku.sku || product.ref,
      price: product.price,
      originalPrice: product.oldPrice ?? undefined,
      image: resolveMediaUrl(selectedSku.imageUrl) || getPrimaryImageUrl(product, selectedSku),
      material: selectedSku.label || product.subtitle || product.name,
      tag: product.ref,
    });
    setAddedToast(true);
  };

  const handleDirectCheckout = () => {
    if (!selectedSku) return;
    handleAddToBag();
    router.push('/checkout');
  };

  if (loading) return <ProductDetailsSkeleton />;

  if (!product) {
    return (
      <div className="w-full min-h-screen bg-background text-on-surface antialiased flex items-center justify-center px-margin">
        <section className="max-w-sm w-full text-center space-y-3 p-8 rounded-xl bg-surface-container-lowest subtle-hairline">
          <span className="material-symbols-outlined text-[40px] text-outline">
            inventory_2
          </span>
          <h1 className="font-headline-sm text-headline-sm font-bold text-on-surface">
            {t('notFoundTitle')}
          </h1>
          <p className="font-body-sm text-body-sm text-secondary">{t('notFoundDesc')}</p>
          <Link
            href="/"
            className="mt-2 inline-block px-4 py-2 rounded-lg bg-on-surface text-surface-container-lowest font-label-caps text-[11px] font-bold tracking-wider"
          >
            {t('browseCatalog')}
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background text-on-surface antialiased pb-32">
      {addedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-surface-container-lowest px-4 py-2.5 rounded-lg shadow-xl flex items-center space-x-2 border border-primary-container/40 animate-in fade-in slide-in-from-top-4 duration-200">
          <span
            className="material-symbols-outlined text-primary-container text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          <span className="font-label-caps text-[11px] tracking-wider font-semibold">
            {t('addedToBagWithPrice', { price: formatPrice(product.price, currency) })}
          </span>
        </div>
      )}

      <div className="max-w-md md:max-w-4xl mx-auto px-margin pt-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center space-x-1 text-on-surface-variant hover:text-primary transition-colors py-1 font-label-caps text-[11px]"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>{tCommon('back')}</span>
        </Link>
        <span className="font-label-caps text-[10px] text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded">
          {t('skuLabel')}: {selectedSku?.sku ?? product.ref ?? ''}
        </span>
      </div>

      <main className="max-w-md md:max-w-4xl mx-auto px-margin pt-2 space-y-6 md:grid md:grid-cols-2 md:gap-8 md:space-y-0">
        <section aria-label={t('galleryLabel')} className="space-y-3">
          <div className="relative bg-surface-container-lowest rounded-xl p-4 subtle-hairline gold-bloom overflow-hidden group">
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-lowest gold-hairline text-on-surface font-label-caps text-label-caps shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
                {t('badgeFeatured')}
              </span>
            </div>

            <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
              <button
                onClick={() => toggleWishlist(product.id)}
                className={`w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur-md subtle-hairline flex items-center justify-center transition-all shadow-sm active:scale-90 ${
                  wishlisted ? 'text-error' : 'text-secondary hover:text-error'
                }`}
                aria-label={t('wishlist')}
                type="button"
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={wishlisted ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  favorite
                </span>
              </button>
            </div>

            <div className="w-full aspect-square flex items-center justify-center pt-4 pb-2">
              {activeImage?.url ? (
                <img
                  src={resolveMediaUrl(activeImage.url)}
                  alt={t('imageAlt', { name: product.name })}
                  className="w-full h-full object-contain filter drop-shadow-md transition-all duration-300 ease-out group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-outline">
                  <span className="material-symbols-outlined text-[40px]">image</span>
                  <span className="font-body-sm text-body-sm">{t('noImage')}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-1.5 pt-1">
              {galleryImages.map((image, index) => (
                <span
                  key={image.id}
                  className={`h-1 rounded-full transition-all duration-200 ${
                    index === activeImageIndex ? 'w-6 bg-primary' : 'w-2 bg-outline-variant/40'
                  }`}
                />
              ))}
            </div>
          </div>

          {galleryImages.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {galleryImages.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => setActiveImageIndex(index)}
                  className={`w-16 h-16 rounded-lg bg-surface-container-lowest p-1 flex-shrink-0 transition-all ${
                    index === activeImageIndex
                      ? 'border-2 border-primary-container gold-bloom'
                      : 'subtle-hairline opacity-75 hover:opacity-100'
                  }`}
                  type="button"
                  aria-label={t('imageAlt', { name: product.name })}
                >
                  <img
                    src={resolveMediaUrl(image.url)}
                    alt={t('imageAlt', { name: product.name })}
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        <section aria-label={t('detailsLabel')} className="space-y-4">
          <div className="space-y-1">
            {categoryLabel && (
              <span className="font-label-caps text-label-caps text-primary tracking-widest uppercase font-bold">
                {categoryLabel}
              </span>
            )}
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">
              {product.name}
            </h1>
            {product.subtitle && (
              <p className="font-body-sm text-body-sm text-secondary">{product.subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/30">
            <div className="flex items-center text-primary-container" aria-hidden="true">
              {[...Array(5)].map((_, index) => (
                <span
                  key={index}
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  star
                </span>
              ))}
            </div>
            <span className="font-label-numeric text-label-numeric font-bold text-on-surface">
              {rating === null ? t('reviewsUnavailable') : rating.toFixed(1)}
            </span>
            <span className="font-body-sm text-body-sm text-secondary">
              {t('soldCount', { count: salesCount })}
            </span>
          </div>

          <div className="bg-surface-container-lowest p-4 rounded-xl subtle-hairline space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatPrice(product.price, currency)}
              </span>
              {product.oldPrice && product.oldPrice > product.price && (
                <>
                  <span className="font-label-numeric text-label-numeric text-secondary line-through">
                    {formatPrice(product.oldPrice, currency)}
                  </span>
                  <span className="font-label-caps text-label-caps px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-bold">
                    {t('discountPercent', { percent: discountPercent })}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <span className="font-label-caps text-[11px] text-on-surface uppercase tracking-wider block font-semibold">
              {t('selectOption')}
            </span>
            {groups.length === 0 ? (
              <p className="font-body-sm text-body-sm text-secondary">{t('noOptions')}</p>
            ) : (
              groups.map((group) => (
                <div key={group.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-label-caps text-[10px] font-semibold text-secondary uppercase tracking-wider">
                      {group.name || t(VARIANT_LABEL_KEYS[group.variantType])}
                    </span>
                    <span className="font-label-caps text-[9px] text-outline uppercase tracking-wider">
                      {t(VARIANT_LABEL_KEYS[group.variantType])}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {buildVariantOptions(group).map((option) => {
                      const key = `${group.key}-${option.value}`;
                      if (!option.variant) {
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled
                            className="p-2.5 rounded-lg bg-surface-container-lowest subtle-hairline opacity-40 cursor-not-allowed flex flex-col items-center space-y-1"
                          >
                            <span className="font-label-caps text-[10px] font-semibold text-on-surface">
                              {option.value}
                            </span>
                            <span className="font-label-caps text-[9px] text-outline">
                              {t('variantUnavailable')}
                            </span>
                          </button>
                        );
                      }

                      const variant = option.variant;
                      const isSelected = selectedValueIds[group.key] === variant.id;
                      const isSelectable = canSelectOption(group.key, variant.id);
                      return (
                        <button
                          key={key}
                          onClick={() => selectValue(group.key, variant.id)}
                          disabled={!isSelectable}
                          className={`p-2.5 rounded-lg text-left transition-all flex flex-col space-y-1.5 ${
                            isSelected
                              ? 'bg-surface-container border-2 border-primary-container shadow-sm'
                              : 'bg-surface-container-lowest subtle-hairline hover:border-outline'
                          } ${isSelectable ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                          type="button"
                        >
                          <div className="flex items-center justify-between">
                            {group.variantType === 'COLOR' ? (
                              <span
                                className="w-4 h-4 rounded-full border border-outline-variant"
                                style={{ backgroundColor: variant.hexColor || '#C5A059' }}
                              />
                            ) : (
                              <span className="font-label-caps text-[10px] font-semibold text-on-surface">
                                {option.value}
                              </span>
                            )}
                            {isSelected && (
                              <span className="material-symbols-outlined text-primary text-[14px]">
                                check
                              </span>
                            )}
                          </div>
                          {group.variantType === 'COLOR' && (
                            <span className="font-label-caps text-[10px] font-semibold text-on-surface truncate">
                              {option.value}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-lg bg-surface-container p-3 subtle-hairline space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="font-label-caps text-[10px] text-outline uppercase tracking-wider">
                {t('selectedSku')}
              </span>
              <span className="font-title-md text-[12px] font-semibold text-on-surface text-right">
                {selectedSku?.label ?? t('addUnavailable')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-label-numeric text-[10px] text-secondary">
                {t('skuLabel')}: {selectedSku?.sku ?? product.ref ?? ''}
              </span>
              <span
                className={`font-label-caps text-[10px] font-semibold ${
                  selectedSku ? 'text-primary' : 'text-error'
                }`}
              >
                {selectedSku
                  ? t('stockCount', { count: selectedSku.stockQuantity })
                  : t('outOfStock')}
              </span>
            </div>
          </div>

          {applicableOffers.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-label-caps text-[11px] text-primary uppercase tracking-widest font-bold">
                {t('offersTitle')}
              </h3>
              <div className="rounded-xl bg-surface-container-lowest subtle-hairline divide-y divide-outline-variant/20">
                {applicableOffers.map((offer) => {
                  const rule = offer.singleRule;
                  const label =
                    rule?.mode === 'BUY_X_GET_Y_FREE'
                      ? t('offers.buyXGetYFree', {
                          buy: rule.buyQuantity,
                          free: rule.freeQuantity ?? 0,
                        })
                      : t('offers.freeShipping');
                  return (
                    <div key={offer.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-title-md text-[12px] font-semibold text-on-surface truncate">
                          {offer.name}
                        </p>
                        <p className="font-body-sm text-[11px] text-secondary">{label}</p>
                      </div>
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        local_offer
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <h3 className="font-label-caps text-[11px] text-primary uppercase tracking-widest font-bold">
              {t('specsTitle')}
            </h3>
            <div className="bg-surface-container-lowest rounded-xl subtle-hairline divide-y divide-outline-variant/20 text-xs">
              <div className="p-3 flex items-start justify-between gap-4">
                <span className="text-secondary whitespace-nowrap">{t('specs.description')}</span>
                <span className="font-semibold text-on-surface text-right">
                  {product.description ?? product.subtitle ?? t('specs.noDescription')}
                </span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-secondary">{t('specs.reference')}</span>
                <span className="font-semibold text-on-surface">{product.ref}</span>
              </div>
              <div className="p-3 flex items-start justify-between gap-4">
                <span className="text-secondary whitespace-nowrap">{t('specs.collection')}</span>
                <span className="font-semibold text-on-surface text-right">
                  {product.families.map((family) => family.name).join(', ') ||
                    product.categories.map((category) => category.name).join(', ') ||
                    t('specs.noCollection')}
                </span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-secondary">{t('specs.availability')}</span>
                <span className="font-semibold text-on-surface">
                  {t('stockCount', { count: product.quantity })}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {product.families.length > 0 && (
        <section className="max-w-md md:max-w-4xl mx-auto px-margin mt-10 space-y-3">
          <div className="space-y-0.5">
            <h2 className="font-label-caps text-[11px] text-primary uppercase tracking-widest font-bold">
              {t('relatedTitle')}
            </h2>
            <p className="font-body-sm text-[11px] text-secondary">
              {t('relatedSubtitle', {
                families: product.families.map((family) => family.name).join(', '),
              })}
            </p>
          </div>

          {relatedProducts.length === 0 ? (
            <div className="rounded-xl bg-surface-container-lowest subtle-hairline p-6 text-center">
              <span className="material-symbols-outlined text-[28px] text-outline">
                groups
              </span>
              <p className="font-body-sm text-body-sm text-secondary mt-1">
                {t('relatedEmpty')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              {relatedProducts.map(({ product: related, sharedFamilies }) => {
                const relatedSku = getPrimarySku(related);
                const image = getPrimaryImageUrl(related, relatedSku);
                const relatedRating = getRating(related);
                const tag = sharedFamilies[0]?.name ?? related.categories[0]?.name ?? '';
                const href = `/products/${encodeURIComponent(related.id)}`;

                return (
                  <article
                    key={related.id}
                    className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-3 flex flex-col justify-between hover:border-primary-container/60 transition-all gold-glow-subtle group"
                  >
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        {tag && (
                          <span className="px-1.5 py-0.5 rounded bg-surface border border-primary-container/60 text-primary font-label-caps text-[9px] font-bold line-clamp-1">
                            {tag}
                          </span>
                        )}
                        <div className="flex items-center text-primary space-x-0.5 flex-shrink-0">
                          <span
                            className="material-symbols-outlined text-[13px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            star
                          </span>
                          <span className="font-label-numeric text-[11px] font-semibold text-on-surface">
                            {relatedRating === null ? '—' : relatedRating.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <Link
                        href={href}
                        className="w-full h-32 sm:h-40 rounded-lg bg-surface-container-low overflow-hidden relative flex items-center justify-center border border-outline-variant/20 mb-2.5 block"
                      >
                        {image ? (
                          <img
                            src={image}
                            alt={t('imageAlt', { name: related.name })}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-[36px] text-outline">
                            image
                          </span>
                        )}
                      </Link>

                      <Link href={href}>
                        <h3 className="font-title-md text-[14px] leading-tight text-on-surface font-semibold line-clamp-1 hover:text-primary transition-colors">
                          {related.name}
                        </h3>
                      </Link>
                      <p className="font-body-sm text-[11px] text-outline mt-0.5 line-clamp-1">
                        {related.subtitle ?? related.ref}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between gap-2">
                      <span className="font-label-numeric text-[15px] font-bold text-on-surface">
                        {formatPrice(related.price, currency)}
                      </span>
                      <Link
                        href={href}
                        aria-label={t('relatedView', { name: related.name })}
                        className="w-8 h-8 rounded-lg bg-on-surface text-surface-container-lowest flex items-center justify-center border border-primary-container/40 active:scale-90 transition-all hover:bg-primary"
                      >
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <aside className="fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 dark:bg-inverse-surface/95 backdrop-blur-md border-t border-outline-variant/30 py-3 px-margin shadow-2xl">
        <div className="max-w-md md:max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={handleAddToBag}
            disabled={!selectedSku}
            className="flex-1 py-3 px-4 rounded-lg border border-primary-container text-on-surface hover:bg-surface-container font-label-caps text-[11px] font-bold tracking-wider flex items-center justify-center space-x-2 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">
              shopping_bag
            </span>
            <span>
              {selectedSku
                ? `${tCommon('addToBag')} • ${formatPrice(product.price, currency)}`
                : t('addUnavailable')}
            </span>
          </button>

          <button
            onClick={handleDirectCheckout}
            disabled={!selectedSku}
            className="flex-1 py-3 px-4 rounded-lg bg-on-surface text-surface-container-lowest border border-primary-container/60 font-label-caps text-[11px] font-bold tracking-wider flex items-center justify-center space-x-2 gold-glow-interactive active:scale-95 transition-all hover:bg-primary disabled:opacity-50 disabled:pointer-events-none"
            type="button"
          >
            <span>{t('checkoutNow')}</span>
            <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">
              arrow_forward
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
}
