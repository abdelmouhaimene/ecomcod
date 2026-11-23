'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type {
  AppliedOfferSelectionPayload,
  PublicOffer,
  PublicProduct,
  PublicProductSku,
} from '@repo/types';
import { OfferCountdown } from '../../../components/offers/offer-countdown';
import { useStore, type AppliedOfferItem } from '../../../context/store-context';
import { catalogApi } from '../../../lib/api';
import { formatPrice, getPrimaryImageUrl, resolveMediaUrl } from '../../../lib/catalog';
import {
  VARIANT_LABEL_KEYS,
  buildVariantGroups,
  buildVariantOptions,
  canSelectVariant,
  findSelectedSku,
  initialVariantSelection,
  type VariantSelection,
} from '../../../lib/variants';

interface OfferProductRow {
  product: PublicProduct;
  paidQuantity: number;
  freeQuantity: number;
  mode: 'SINGLE_PRODUCT' | 'PACK';
}

/** One physical unit of an offered product, with its own variant choice. */
interface OfferPiece {
  id: string;
  rowId: string;
  product: PublicProduct;
  isFree: boolean;
  label: string;
}

function offerRowKey(row: OfferProductRow, index: number): string {
  return `${row.product.id}-${row.mode}-${index}`;
}

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
  if (language.startsWith('fr')) return value === 1 ? `${number}er` : `${number}e`;
  return number;
}

function VariantPicker({
  piece,
  selection,
  selectedSku,
  canChoose,
  onSelect,
}: {
  piece: OfferPiece;
  selection: VariantSelection;
  selectedSku: PublicProductSku | null;
  canChoose: (groupKey: string, valueId: string) => boolean;
  onSelect: (groupKey: string, valueId: string) => void;
}) {
  const t = useTranslations('offer');
  const groups = React.useMemo(() => buildVariantGroups(piece.product), [piece.product]);

  if (groups.length === 0) {
    return (
      <p className="font-body-sm text-[11px] text-secondary">
        {t('selectedVariant')}: {selectedSku?.label ?? t('noVariants')}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="font-label-caps text-[10px] text-primary uppercase tracking-widest font-bold">
        {t('selectVariant')}
      </p>
      {groups.map((group) => (
        <div key={group.key} className="space-y-1.5">
          <span className="font-label-caps text-[10px] font-semibold text-secondary uppercase tracking-wider">
            {group.name || t(VARIANT_LABEL_KEYS[group.variantType])}
          </span>
          <div className="flex flex-wrap gap-2">
            {buildVariantOptions(group).map((option) => {
              if (!option.variant) {
                return (
                  <button
                    key={`${group.key}-${option.value}`}
                    type="button"
                    disabled
                    className="px-3 py-1.5 rounded-lg bg-surface-container-lowest subtle-hairline opacity-40 cursor-not-allowed font-label-caps text-[10px] font-semibold text-on-surface"
                  >
                    {option.value}
                  </button>
                );
              }

              const variant = option.variant;
              const isSelected = selection[group.key] === variant.id;
              const isSelectable = canChoose(group.key, variant.id);
              return (
                <button
                  key={`${group.key}-${variant.id}`}
                  type="button"
                  disabled={!isSelectable}
                  onClick={() => onSelect(group.key, variant.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-label-caps text-[10px] font-semibold ${
                    isSelected
                      ? 'bg-surface-container border border-primary-container text-on-surface'
                      : 'bg-surface-container-lowest subtle-hairline text-on-surface hover:border-outline'
                  } ${isSelectable ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                >
                  {group.variantType === 'COLOR' && (
                    <span
                      className="w-3 h-3 rounded-full border border-outline-variant"
                      style={{ backgroundColor: variant.hexColor || '#C5A059' }}
                    />
                  )}
                  <span>{option.value}</span>
                  {isSelected && (
                    <span className="material-symbols-outlined text-primary text-[13px]">check</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function OfferPieceCard({
  piece,
  selection,
  selectedSku,
  canChoose,
  onSelect,
}: {
  piece: OfferPiece;
  selection: VariantSelection;
  selectedSku: PublicProductSku | null;
  canChoose: (groupKey: string, valueId: string) => boolean;
  onSelect: (groupKey: string, valueId: string) => void;
}) {
  const t = useTranslations('offer');
  const image = resolveMediaUrl(selectedSku?.imageUrl) || getPrimaryImageUrl(piece.product);

  return (
    <div className="rounded-lg bg-surface-container-low/60 subtle-hairline p-3 space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded bg-surface-container-low overflow-hidden border border-outline-variant/20 flex-shrink-0">
          {image ? (
            <img src={image} alt={t('imageAlt', { name: piece.product.name })} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-outline text-[18px]">image</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span
              className={`font-label-caps text-[9px] font-bold uppercase tracking-wider ${
                piece.isFree ? 'text-primary' : 'text-secondary'
              }`}
            >
              {piece.label}
            </span>
            <span
              className={`font-label-caps text-[9px] font-bold uppercase tracking-wider ${
                selectedSku ? 'text-primary' : 'text-error'
              }`}
            >
              {selectedSku ? t('stockCount', { count: selectedSku.stockQuantity }) : t('outOfStock')}
            </span>
          </div>
          <p className="font-body-sm text-[10px] text-secondary truncate">
            {selectedSku?.label ?? t('noVariants')}
          </p>
        </div>
      </div>

      <VariantPicker
        piece={piece}
        selection={selection}
        selectedSku={selectedSku}
        canChoose={canChoose}
        onSelect={onSelect}
      />
    </div>
  );
}

function OfferProductCard({
  row,
  pieces,
  selections,
  selectedSkuByPiece,
  canChoose,
  onSelect,
}: {
  row: OfferProductRow;
  pieces: OfferPiece[];
  selections: Record<string, VariantSelection>;
  selectedSkuByPiece: Map<string, PublicProductSku | null>;
  canChoose: (pieceId: string, groupKey: string, valueId: string) => boolean;
  onSelect: (pieceId: string, groupKey: string, valueId: string) => void;
}) {
  const t = useTranslations('offer');
  const tCommon = useTranslations('common');
  const firstSku = selectedSkuByPiece.get(pieces[0]?.id ?? '') ?? null;
  const image = resolveMediaUrl(firstSku?.imageUrl) || getPrimaryImageUrl(row.product);

  return (
    <article className="rounded-xl bg-surface-container-lowest subtle-hairline p-4 flex flex-col sm:flex-row gap-4">
      <div className="w-full sm:w-32 h-32 rounded-lg bg-surface-container-low overflow-hidden border border-outline-variant/20 flex-shrink-0">
        {image ? (
          <img src={image} alt={t('imageAlt', { name: row.product.name })} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-outline text-[32px]">image</span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="font-title-md text-[15px] font-semibold text-on-surface">
              {row.product.name}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              {row.paidQuantity > 0 && (
                <span className="px-2 py-0.5 rounded bg-surface-container font-label-caps text-[9px] font-bold text-on-surface uppercase tracking-wider">
                  {row.mode === 'PACK'
                    ? t('packQuantity', { count: row.paidQuantity })
                    : t('buyQuantity', { count: row.paidQuantity })}
                </span>
              )}
              {row.freeQuantity > 0 && (
                <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-label-caps text-[9px] font-bold uppercase tracking-wider">
                  {t('freeQuantity', { count: row.freeQuantity })}
                </span>
              )}
              <span className="font-label-numeric text-[11px] text-secondary">
                {formatPrice(row.product.price, tCommon('currency'))}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {pieces.map((piece) => (
            <OfferPieceCard
              key={piece.id}
              piece={piece}
              selection={selections[piece.id] ?? {}}
              selectedSku={selectedSkuByPiece.get(piece.id) ?? null}
              canChoose={(groupKey, valueId) => canChoose(piece.id, groupKey, valueId)}
              onSelect={(groupKey, valueId) => onSelect(piece.id, groupKey, valueId)}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

export function OfferDetailsSkeleton() {
  return (
    <div className="w-full min-h-screen bg-background px-margin py-8 animate-pulse">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="h-24 rounded-xl bg-surface-container-low" />
        <div className="h-40 rounded-xl bg-surface-container-low" />
        <div className="h-56 rounded-xl bg-surface-container-low" />
      </div>
    </div>
  );
}

export default function OfferDetails() {
  const t = useTranslations('offer');
  const tHome = useTranslations('home');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';
  const { addOfferToCart, appliedOffers } = useStore();

  const [offer, setOffer] = React.useState<PublicOffer | null>(null);
  const [products, setProducts] = React.useState<PublicProduct[]>([]);
  const [pieceSelections, setPieceSelections] = React.useState<Record<string, VariantSelection>>({});
  const [loading, setLoading] = React.useState(true);
  const [addedToast, setAddedToast] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.allSettled([catalogApi.getOffer(id), catalogApi.listProducts()]).then(
      ([offerResult, productsResult]) => {
        if (cancelled) return;
        setOffer(offerResult.status === 'fulfilled' ? offerResult.value : null);
        setProducts(productsResult.status === 'fulfilled' ? productsResult.value : []);
        setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  const rows = React.useMemo<OfferProductRow[]>(() => {
    if (!offer) return [];
    const byId = new Map(products.map((product) => [product.id, product]));

    if (offer.type === 'SINGLE_PRODUCT' && offer.singleRule) {
      const product = byId.get(offer.singleRule.productId);
      if (!product) return [];
      return [
        {
          product,
          paidQuantity: offer.singleRule.buyQuantity,
          freeQuantity:
            offer.singleRule.mode === 'BUY_X_GET_Y_FREE'
              ? offer.singleRule.freeQuantity ?? 0
              : 0,
          mode: 'SINGLE_PRODUCT',
        },
      ];
    }

    if (offer.type === 'PACK') {
      return offer.packItems.flatMap((item) => {
        const product = byId.get(item.productId);
        return product
          ? [
              {
                product,
                paidQuantity: item.quantity,
                freeQuantity: 0,
                mode: 'PACK' as const,
              },
            ]
          : [];
      });
    }

    return [];
  }, [offer, products]);

  const expectedRowCount =
    offer?.type === 'PACK' ? offer.packItems.length : offer?.singleRule ? 1 : 0;
  const hasMissingProducts = Boolean(offer && rows.length !== expectedRowCount);

  const pieces = React.useMemo<OfferPiece[]>(() => {
    const result: OfferPiece[] = [];
    rows.forEach((row, rowIndex) => {
      const rowId = offerRowKey(row, rowIndex);
      for (let index = 0; index < row.paidQuantity; index += 1) {
        result.push({
          id: `${rowId}:paid:${index}`,
          rowId,
          product: row.product,
          isFree: false,
          label:
            row.mode === 'PACK'
              ? t('packPiece', { index: index + 1 })
              : t('paidPiece', { index: index + 1 }),
        });
      }
      for (let index = 0; index < row.freeQuantity; index += 1) {
        result.push({
          id: `${rowId}:free:${index}`,
          rowId,
          product: row.product,
          isFree: true,
          label: t('freePiece', { index: index + 1 }),
        });
      }
    });
    return result;
  }, [rows, t]);

  const pieceById = React.useMemo(
    () => new Map(pieces.map((piece) => [piece.id, piece])),
    [pieces]
  );

  React.useEffect(() => {
    const next: Record<string, VariantSelection> = {};
    for (const piece of pieces) {
      next[piece.id] = initialVariantSelection(
        piece.product,
        buildVariantGroups(piece.product),
        1
      );
    }
    setPieceSelections(next);
  }, [pieces]);

  const selectedSkuByPiece = React.useMemo(() => {
    const result = new Map<string, PublicProductSku | null>();
    for (const piece of pieces) {
      result.set(
        piece.id,
        findSelectedSku(piece.product, pieceSelections[piece.id] ?? {}, 1)
      );
    }
    return result;
  }, [pieces, pieceSelections]);

  const usageBySku = React.useMemo(() => {
    const result = new Map<string, number>();
    for (const piece of pieces) {
      const sku = selectedSkuByPiece.get(piece.id);
      if (sku) result.set(sku.id, (result.get(sku.id) ?? 0) + 1);
    }
    return result;
  }, [pieces, selectedSkuByPiece]);

  const hasStockConflict = React.useMemo(
    () =>
      pieces.some((piece) => {
        const sku = selectedSkuByPiece.get(piece.id);
        return Boolean(sku && (usageBySku.get(sku.id) ?? 0) > sku.stockQuantity);
      }),
    [pieces, selectedSkuByPiece, usageBySku]
  );

  const canChooseVariant = (pieceId: string, groupKey: string, valueId: string): boolean => {
    const piece = pieceById.get(pieceId);
    if (!piece) return false;
    const selection = pieceSelections[pieceId] ?? {};
    if (!canSelectVariant(piece.product, selection, groupKey, valueId, 1)) return false;

    const candidate = findSelectedSku(
      piece.product,
      { ...selection, [groupKey]: valueId },
      1
    );
    if (!candidate) return false;

    const current = selectedSkuByPiece.get(pieceId);
    const currentUsage = usageBySku.get(candidate.id) ?? 0;
    const usedByThisPiece = current?.id === candidate.id ? 1 : 0;
    return currentUsage - usedByThisPiece + 1 <= candidate.stockQuantity;
  };

  const handleSelectVariant = (pieceId: string, groupKey: string, valueId: string) => {
    setPieceSelections((current) => ({
      ...current,
      [pieceId]: {
        ...current[pieceId],
        [groupKey]: valueId,
      },
    }));
  };

  const regularTotal = rows.reduce(
    (sum, row) => sum + row.product.price * (row.paidQuantity + row.freeQuantity),
    0
  );
  const offerTotal =
    offer?.type === 'PACK'
      ? offer.packPrice ?? regularTotal
      : rows.reduce((sum, row) => sum + row.product.price * row.paidQuantity, 0);
  const totalUnits = rows.reduce((sum, row) => sum + row.paidQuantity + row.freeQuantity, 0);
  const savings = Math.max(0, regularTotal - offerTotal);
  const currency = tCommon('currency');

  const now = Date.now();
  const startsAt = offer?.startsAt ? new Date(offer.startsAt).getTime() : null;
  const endsAt = offer?.endsAt ? new Date(offer.endsAt).getTime() : null;
  const notStarted = startsAt !== null && startsAt > now;
  const ended = endsAt !== null && endsAt <= now;
  const available = Boolean(offer?.isActive) && !notStarted && !ended;
  const alreadyAdded = Boolean(offer && appliedOffers.some((entry) => entry.offerId === offer.id));
  const allVariantsReady =
    pieces.length > 0 && pieces.every((piece) => selectedSkuByPiece.get(piece.id)) && !hasStockConflict;
  const canAdd = available && allVariantsReady && !alreadyAdded && !hasMissingProducts;

  const title = React.useMemo(() => {
    if (!offer || rows.length === 0) return '';
    if (offer.type === 'SINGLE_PRODUCT' && offer.singleRule) {
      const product = rows[0]?.product;
      if (!product) return offer.name;
      const freeQuantity = offer.singleRule.freeQuantity ?? 0;
      return offer.singleRule.mode === 'BUY_X_GET_Y_FREE'
        ? freeQuantity === 1
          ? tHome('offers.titleBuyGetOne', {
              buy: offer.singleRule.buyQuantity,
              product: product.name,
              ordinal: formatOrdinal(offer.singleRule.buyQuantity + freeQuantity, locale),
            })
          : tHome('offers.titleBuyGetMany', {
              buy: offer.singleRule.buyQuantity,
              product: product.name,
              free: freeQuantity,
            })
        : tHome('offers.titleFreeShipping', {
            buy: offer.singleRule.buyQuantity,
            product: product.name,
          });
    }
    return tHome('offers.titlePack', {
      count: totalUnits,
      product: [...new Set(rows.map((row) => row.product.name))].join(', '),
    });
  }, [locale, offer, rows, tHome, totalUnits]);

  const buildPayload = () => {
    if (!offer || !allVariantsReady) return null;
    const items: AppliedOfferItem[] = [];
    const selections: AppliedOfferSelectionPayload[] = [];

    for (const piece of pieces) {
      const sku = selectedSkuByPiece.get(piece.id);
      if (!sku) continue;
      const base = {
        skuId: sku.id,
        productId: piece.product.id,
        name: piece.product.name,
        sku: sku.sku || piece.product.ref,
        image: resolveMediaUrl(sku.imageUrl) || getPrimaryImageUrl(piece.product),
        material: sku.label || piece.product.subtitle || piece.product.name,
      };
      items.push({
        ...base,
        quantity: 1,
        unitPrice: piece.isFree ? 0 : piece.product.price,
        isFree: piece.isFree || undefined,
      });
      selections.push({ productId: piece.product.id, skuId: sku.id, quantity: 1 });
    }

    return {
      offerId: offer.id,
      name: offer.name,
      mode: offer.type,
      times: 1,
      selections,
      items,
      total: offerTotal,
      freeShipping: offer.freeShipping,
    };
  };

  React.useEffect(() => {
    if (!addedToast) return;
    const timer = window.setTimeout(() => setAddedToast(false), 2500);
    return () => window.clearTimeout(timer);
  }, [addedToast]);

  const handleAddToBag = () => {
    const payload = buildPayload();
    if (!payload) return;
    addOfferToCart(payload);
    setAddedToast(true);
  };

  const handleDirectCheckout = () => {
    if (!canAdd) return;
    handleAddToBag();
    router.push('/checkout');
  };

  if (loading) return <OfferDetailsSkeleton />;

  if (!offer || hasMissingProducts || rows.length === 0) {
    return (
      <div className="w-full min-h-screen bg-background text-on-surface flex items-center justify-center px-margin">
        <section className="max-w-sm w-full text-center space-y-3 p-8 rounded-xl bg-surface-container-lowest subtle-hairline">
          <span className="material-symbols-outlined text-[40px] text-outline">local_offer</span>
          <h1 className="font-headline-sm text-headline-sm font-bold">{t('notFoundTitle')}</h1>
          <p className="font-body-sm text-body-sm text-secondary">{t('notFoundDesc')}</p>
          <Link
            href="/"
            className="mt-2 inline-block px-4 py-2 rounded-lg bg-on-surface text-surface-container-lowest font-label-caps text-[11px] font-bold tracking-wider"
          >
            {t('browseStore')}
          </Link>
        </section>
      </div>
    );
  }

  const statusLabel = notStarted ? t('notStarted') : ended ? t('ended') : !available ? t('unavailable') : null;
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <div className="w-full min-h-screen bg-background text-on-surface antialiased pb-32">
      {addedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-surface-container-lowest px-4 py-2.5 rounded-lg shadow-xl flex items-center space-x-2 border border-primary-container/40 animate-in fade-in slide-in-from-top-4 duration-200">
          <span className="material-symbols-outlined text-primary-container text-[18px]">check_circle</span>
          <span className="font-label-caps text-[11px] tracking-wider font-semibold">{t('added')}</span>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-margin py-6 space-y-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1 font-label-caps text-[10px] text-outline hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[15px]">arrow_back</span>
          {tCommon('back')}
        </Link>

        <section className="relative overflow-hidden rounded-2xl bg-surface-container-lowest border border-primary-container/40 p-5 gold-glow-subtle space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-primary-container text-primary font-label-caps text-[9px] font-bold tracking-wider uppercase">
              <span className="material-symbols-outlined text-[12px]">local_offer</span>
              {offer.type === 'PACK' ? t('badgePack') : t('badgeSingle')}
            </span>
            <OfferCountdown endsAt={offer.endsAt} />
          </div>

          <div className="space-y-1">
            <p className="font-label-caps text-label-caps text-primary uppercase tracking-widest">
              {offer.name}
            </p>
            <h1 className="font-headline-md text-headline-md font-bold text-on-surface">{title}</h1>
            {statusLabel && (
              <p className="font-label-caps text-[10px] text-error font-bold uppercase tracking-wider">
                {statusLabel}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg bg-surface-container p-3 space-y-0.5">
              <span className="block font-label-caps text-[9px] text-outline uppercase tracking-wider">
                {t('offerTotal')}
              </span>
              <strong className="font-label-numeric text-[16px] text-on-surface">
                {formatPrice(offerTotal, currency)}
              </strong>
            </div>
            <div className="rounded-lg bg-surface-container p-3 space-y-0.5">
              <span className="block font-label-caps text-[9px] text-outline uppercase tracking-wider">
                {t('regularTotal')}
              </span>
              <strong className="font-label-numeric text-[14px] text-secondary line-through">
                {formatPrice(regularTotal, currency)}
              </strong>
            </div>
            <div className="rounded-lg bg-surface-container p-3 space-y-0.5">
              <span className="block font-label-caps text-[9px] text-outline uppercase tracking-wider">
                {tHome('offers.effectivePrice')}
              </span>
              <strong className="font-label-numeric text-[14px] text-on-surface">
                {formatPrice(totalUnits > 0 ? offerTotal / totalUnits : 0, currency)}
              </strong>
            </div>
            <div className="rounded-lg bg-surface-container p-3 space-y-0.5">
              <span className="block font-label-caps text-[9px] text-outline uppercase tracking-wider">
                {t('savings')}
              </span>
              <strong className="font-label-numeric text-[14px] text-primary">
                {formatPrice(savings, currency)}
              </strong>
            </div>
          </div>

          {(offer.freeShipping || offer.startsAt || offer.endsAt) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-body-sm text-[11px] text-secondary">
              {offer.freeShipping && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[14px]">local_shipping</span>
                  {tHome('offers.shippingIncluded')}
                </span>
              )}
              {offer.startsAt && (
                <span>
                  {t('startsAt')}: {dateFormatter.format(new Date(offer.startsAt))}
                </span>
              )}
              {offer.endsAt && (
                <span>
                  {t('endsAt')}: {dateFormatter.format(new Date(offer.endsAt))}
                </span>
              )}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-label-caps text-[11px] text-primary uppercase tracking-widest font-bold">
              {tHome('offers.included')}
            </h2>
            <span className="font-label-caps text-[10px] text-outline uppercase tracking-wider">
              {totalUnits} {tCommon('items')}
            </span>
          </div>
          {hasStockConflict && (
            <p className="font-body-sm text-[11px] text-error">{t('stockConflict')}</p>
          )}
          <div className="space-y-3">
            {rows.map((row, rowIndex) => {
              const rowId = offerRowKey(row, rowIndex);
              return (
                <OfferProductCard
                  key={rowId}
                  row={row}
                  pieces={pieces.filter((piece) => piece.rowId === rowId)}
                  selections={pieceSelections}
                  selectedSkuByPiece={selectedSkuByPiece}
                  canChoose={canChooseVariant}
                  onSelect={handleSelectVariant}
                />
              );
            })}
          </div>
        </section>
      </main>

      <aside className="fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 dark:bg-inverse-surface/95 backdrop-blur-md border-t border-outline-variant/30 py-3 px-margin shadow-2xl">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <span className="block font-label-caps text-[9px] text-outline uppercase tracking-wider">
              {t('offerTotal')}
            </span>
            <strong className="font-label-numeric text-[16px] text-on-surface">
              {formatPrice(offerTotal, currency)}
            </strong>
          </div>
          <button
            type="button"
            onClick={handleAddToBag}
            disabled={!canAdd}
            className="flex-1 py-3 px-4 rounded-lg border border-primary-container text-on-surface hover:bg-surface-container font-label-caps text-[11px] font-bold tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">shopping_bag</span>
            <span>{alreadyAdded ? t('alreadyAdded') : t('addToBag')}</span>
          </button>
          <button
            type="button"
            onClick={handleDirectCheckout}
            disabled={!canAdd}
            className="flex-1 py-3 px-4 rounded-lg bg-on-surface text-surface-container-lowest border border-primary-container/60 font-label-caps text-[11px] font-bold tracking-wider flex items-center justify-center gap-2 gold-glow-interactive active:scale-95 transition-all hover:bg-primary disabled:opacity-50 disabled:pointer-events-none"
          >
            <span>{t('checkoutNow')}</span>
            <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">arrow_forward</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
