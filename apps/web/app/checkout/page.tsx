'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '../../context/auth-context';
import { useStore } from '../../context/store-context';
import { ApiError, catalogApi } from '../../lib/api';
import { formatPrice } from '../../lib/catalog';
import {
  communesForWilaya,
  fetchLocationData,
  localizedLocationName,
  normalizeAlgerianPhone,
  type CommuneOption,
  type WilayaOption,
} from '../../lib/locations';

type ShippingOption = 'whiteGlove' | 'vaultCourier';

export default function CheckoutPage() {
  const t = useTranslations('checkout');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const {
    cart,
    appliedOffers,
    updateQuantity,
    removeFromCart,
    removeAppliedOffer,
    clearCart,
    subtotal,
    totalCount,
  } = useStore();

  const [shippingOption, setShippingOption] = React.useState<ShippingOption>('whiteGlove');
  const [customerName, setCustomerName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [wilayas, setWilayas] = React.useState<WilayaOption[]>([]);
  const [communes, setCommunes] = React.useState<CommuneOption[]>([]);
  const [wilayaCode, setWilayaCode] = React.useState('');
  const [communeCode, setCommuneCode] = React.useState('');
  const [locationDataError, setLocationDataError] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = React.useState(false);

  const currency = tCommon('currency');
  const fieldClass =
    'w-full px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant/50 text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-primary-container disabled:opacity-60';

  React.useEffect(() => {
    let cancelled = false;

    void fetchLocationData()
      .then(({ wilayas: list, communes: towns }) => {
        if (cancelled) return;
        setWilayas(list);
        setCommunes(towns);
      })
      .catch(() => {
        if (!cancelled) setLocationDataError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // The account supplies defaults; edits below belong to this order only.
  React.useEffect(() => {
    if (!user) return;
    if (user.fullName) setCustomerName(user.fullName);
    if (user.phoneNumber) setPhone(user.phoneNumber);
    if (user.wilayaCode) setWilayaCode(user.wilayaCode);
    if (user.communeCode) setCommuneCode(user.communeCode);
  }, [user?.id]);

  const availableCommunes = React.useMemo(
    () => communesForWilaya(communes, wilayaCode, locale),
    [communes, locale, wilayaCode]
  );
  const selectedWilaya = wilayas.find((wilaya) => wilaya.code === wilayaCode) ?? null;
  const selectedCommune = availableCommunes.find((commune) => commune.code === communeCode) ?? null;

  const hasFreeShipping = appliedOffers.some((offer) => offer.freeShipping);
  const shippingCost = hasFreeShipping || shippingOption === 'whiteGlove' ? 0 : 45;
  const total = subtotal + shippingCost;

  // Buy-X-get-Y offers need their paid units in `items`; the API adds free and
  // pack lines itself from `offers`, so those lines are never sent as regular.
  const offerPaidItems = [
    ...appliedOffers
      .filter((offer) => offer.mode === 'SINGLE_PRODUCT')
      .flatMap((offer) =>
        offer.items
          .filter((item) => !item.isFree)
          .map((item) => ({ skuId: item.skuId, quantity: item.quantity }))
      )
      .reduce((map, item) => {
        map.set(item.skuId, (map.get(item.skuId) ?? 0) + item.quantity);
        return map;
      }, new Map<string, number>())
      .entries(),
  ].map(([skuId, quantity]) => ({ skuId, quantity }));

  const localizedError = (cause: unknown): string => {
    if (!(cause instanceof ApiError)) return t('errorNetwork');
    if (cause.status === 409 || /stock|quantity/i.test(cause.message)) {
      return t('errorOutOfStock');
    }
    if (cause.status === 400 || cause.status === 422) return t('errorInvalidOrder');
    return cause.message
      ? t('errorWithMessage', { message: cause.message })
      : t('errorGeneric');
  };

  const handlePlaceOrder = async () => {
    if ((cart.length === 0 && appliedOffers.length === 0) || isPlacingOrder) return;

    const name = customerName.trim();
    const normalizedPhone = normalizeAlgerianPhone(phone);

    if (!name) {
      setError(t('nameRequired'));
      return;
    }
    if (!normalizedPhone) {
      setError(t('phoneInvalid'));
      return;
    }
    if (!selectedWilaya) {
      setError(t('wilayaRequired'));
      return;
    }
    if (!selectedCommune) {
      setError(t('communeRequired'));
      return;
    }

    setIsPlacingOrder(true);
    setError(null);

    try {
      const order = await catalogApi.createOrder({
        source: 'WEB',
        items: [
          ...cart.map((item) => ({ skuId: item.skuId, quantity: item.quantity })),
          ...offerPaidItems,
        ],
        offers: appliedOffers.map((offer) => ({
          offerId: offer.offerId,
          times: offer.times,
          selections: offer.selections,
        })),
        customerName: name,
        customerPhone: normalizedPhone,
        wilayaCode: selectedWilaya.code,
        wilayaName: localizedLocationName(selectedWilaya, locale),
        communeCode: selectedCommune.code,
        communeName: localizedLocationName(selectedCommune, locale),
        baseShippingCost: shippingCost,
      });

      clearCart();
      const query = new URLSearchParams({ order: order.orderNumber, id: order.id });
      router.push(`/order-confirmation?${query.toString()}`);
    } catch (cause) {
      setError(localizedError(cause));
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen pb-36">
      <header className="sticky top-0 bg-surface/85 backdrop-blur-md border-b border-outline-variant/30">
        <div className="max-w-md mx-auto px-margin py-3 flex items-center justify-between">
          <Link
            href="/"
            className="p-1 -ml-1 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center rounded"
            aria-label={t('backToStore')}
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div className="text-center">
            <h1 className="font-label-caps text-label-caps tracking-widest text-primary font-bold uppercase">
              {t('title')}
            </h1>
            <span className="font-label-caps text-[9px] text-on-surface-variant block -mt-0.5">
              {t('secureBadge')}
            </span>
          </div>
          <div className="w-6" />
        </div>
      </header>

      <main className="max-w-md mx-auto px-margin pt-4 space-y-5">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-label-caps text-[11px] text-primary uppercase tracking-widest font-bold">
              {t('itemsInBag')} ({totalCount})
            </h2>
            <Link
              href="/"
              className="font-label-caps text-[10px] text-outline hover:text-primary transition-colors"
            >
              {t('addItems')}
            </Link>
          </div>

          {cart.length === 0 && appliedOffers.length === 0 ? (
            <div className="p-8 text-center bg-surface-container-lowest rounded-xl subtle-hairline">
              <span className="material-symbols-outlined text-[36px] text-outline mb-2">
                shopping_bag
              </span>
              <p className="font-body-sm text-secondary">{t('emptyBag')}</p>
              <Link
                href="/"
                className="mt-4 inline-block px-4 py-2 bg-on-surface text-surface-container-lowest rounded-lg font-label-caps text-[11px] font-semibold"
              >
                {t('browseAtelier')}
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {cart.map((item) => (
                <article
                  key={item.skuId}
                  className="bg-surface-container-lowest rounded-xl p-3 subtle-hairline flex gap-3 items-center justify-between"
                >
                  <div className="w-16 h-16 rounded-lg bg-surface-container-low p-1 subtle-hairline flex-shrink-0 flex items-center justify-center">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="material-symbols-outlined text-[24px] text-outline">
                        image
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-title-md text-[13px] font-semibold text-on-surface truncate">
                      {item.name}
                    </h3>
                    <p className="font-label-caps text-[10px] text-secondary mt-0.5">
                      {item.material}
                    </p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-label-numeric text-[13px] font-bold text-on-surface">
                        {formatPrice(item.price, currency)}
                      </span>
                      {item.originalPrice && (
                        <span className="font-label-numeric text-[11px] text-outline line-through">
                          {formatPrice(item.originalPrice, currency)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-1.5 flex-shrink-0">
                    <button
                      onClick={() => removeFromCart(item.skuId)}
                      className="text-outline hover:text-error transition-colors p-0.5"
                      aria-label={t('removeItem', { name: item.name })}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                    <div className="flex items-center space-x-1.5 bg-surface-container-low rounded-md px-1.5 py-0.5 subtle-hairline">
                      <button
                        onClick={() => updateQuantity(item.skuId, -1)}
                        className="text-secondary hover:text-on-surface text-[14px] leading-none px-1"
                        type="button"
                        aria-label={t('decreaseQuantity', { name: item.name })}
                      >
                        -
                      </button>
                      <span className="font-label-numeric text-[11px] font-bold px-1 text-on-surface">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.skuId, 1)}
                        className="text-secondary hover:text-on-surface text-[14px] leading-none px-1"
                        type="button"
                        aria-label={t('increaseQuantity', { name: item.name })}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {appliedOffers.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-label-caps text-[11px] text-primary uppercase tracking-widest font-bold">
              {t('offersInBag')}
            </h2>
            <div className="space-y-2.5">
              {appliedOffers.map((offer) => (
                <article
                  key={offer.id}
                  className="bg-surface-container-lowest rounded-xl p-3 subtle-hairline border border-primary-container/30 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-title-md text-[13px] font-semibold text-on-surface truncate">
                        {offer.name}
                      </h3>
                      <p className="font-label-caps text-[9px] text-primary uppercase tracking-wider">
                        {t('offerPrice')}
                      </p>
                    </div>
                    <button
                      onClick={() => removeAppliedOffer(offer.id)}
                      className="text-outline hover:text-error transition-colors p-0.5"
                      type="button"
                      aria-label={t('removeOffer', { name: offer.name })}
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {offer.items.map((item, index) => (
                      <div key={`${item.skuId}-${index}`} className="flex items-center gap-2">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-8 h-8 rounded object-contain bg-surface-container-low flex-shrink-0"
                          />
                        ) : (
                          <span className="w-8 h-8 rounded bg-surface-container-low flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-[14px] text-outline">image</span>
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-body-sm text-[11px] text-on-surface truncate">
                            {item.name}
                          </p>
                          <p className="font-label-caps text-[9px] text-secondary">
                            {item.material}
                          </p>
                        </div>
                        <span className="font-label-numeric text-[10px] text-secondary whitespace-nowrap">
                          {item.quantity} × {formatPrice(item.unitPrice, currency)}
                        </span>
                        {item.isFree && (
                          <span className="px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-label-caps text-[9px] font-bold">
                            {t('freeUnit')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-baseline pt-1 border-t border-outline-variant/30">
                    <span className="font-label-caps text-[10px] text-secondary uppercase tracking-wider">
                      {t('offerTotal')}
                    </span>
                    <strong className="font-label-numeric text-[13px] text-on-surface">
                      {formatPrice(offer.total, currency)}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="p-3.5 rounded-xl bg-surface-container-low border border-primary-container/40 flex items-start space-x-3 gold-glow-subtle">
          <span className="material-symbols-outlined text-primary text-[22px] mt-0.5">
            inventory_2
          </span>
          <div>
            <h4 className="font-label-caps text-[11px] font-bold text-on-surface uppercase tracking-wider">
              {t('packagingTitle')}
            </h4>
            <p className="font-body-sm text-[11px] text-secondary mt-0.5">
              {t('packagingDesc')}
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-label-caps text-[11px] text-primary uppercase tracking-widest font-bold">
            {t('customerDetails')}
          </h3>
          <div className="bg-surface-container-lowest rounded-xl subtle-hairline p-3 space-y-2.5">
            <p className="font-body-sm text-[11px] text-secondary">{t('customerDetailsDesc')}</p>
            <p className="font-body-sm text-[10px] text-outline">{t('checkoutOnlyHint')}</p>

            <label className="block space-y-1">
              <span className="font-label-caps text-[10px] text-on-surface uppercase tracking-wider">
                {t('customerName')}
              </span>
              <input
                type="text"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder={t('namePlaceholder')}
                autoComplete="name"
                disabled={isPlacingOrder}
                className={fieldClass}
              />
            </label>

            <label className="block space-y-1">
              <span className="font-label-caps text-[10px] text-on-surface uppercase tracking-wider">
                {t('phone')}
              </span>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={t('phonePlaceholder')}
                autoComplete="tel"
                disabled={isPlacingOrder}
                className={fieldClass}
              />
              <span className="block font-body-sm text-[9px] text-outline">{t('phoneHint')}</span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="font-label-caps text-[10px] text-on-surface uppercase tracking-wider">
                  {t('wilaya')}
                </span>
                <select
                  value={wilayaCode}
                  onChange={(event) => {
                    setWilayaCode(event.target.value);
                    setCommuneCode('');
                  }}
                  disabled={isPlacingOrder || wilayas.length === 0}
                  autoComplete="address-level1"
                  className={fieldClass}
                >
                  <option value="">{t('selectWilaya')}</option>
                  {wilayas.map((wilaya) => (
                    <option key={wilaya.code} value={wilaya.code}>
                      {localizedLocationName(wilaya, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="font-label-caps text-[10px] text-on-surface uppercase tracking-wider">
                  {t('commune')}
                </span>
                <select
                  value={communeCode}
                  onChange={(event) => setCommuneCode(event.target.value)}
                  disabled={isPlacingOrder || availableCommunes.length === 0}
                  autoComplete="address-level2"
                  className={fieldClass}
                >
                  <option value="">{t('selectCommune')}</option>
                  {availableCommunes.map((commune) => (
                    <option key={commune.code} value={commune.code}>
                      {localizedLocationName(commune, locale)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {locationDataError && (
              <p className="font-body-sm text-[10px] text-error">{t('locationUnavailable')}</p>
            )}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-label-caps text-[11px] text-primary uppercase tracking-widest font-bold">
            {t('shippingMethod')}
          </h3>
          <div className="space-y-2">
            <button
              onClick={() => setShippingOption('whiteGlove')}
              className={`w-full p-3 rounded-xl text-left flex items-center justify-between transition-all ${
                shippingOption === 'whiteGlove'
                  ? 'bg-surface-container-lowest border-2 border-primary-container shadow-sm'
                  : 'bg-surface-container-lowest subtle-hairline hover:border-outline'
              }`}
              type="button"
            >
              <div className="flex items-center space-x-2.5">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  verified_user
                </span>
                <div>
                  <p className="font-title-md text-[13px] font-semibold text-on-surface">
                    {t('whiteGlove')}
                  </p>
                  <p className="font-body-sm text-[11px] text-secondary">
                    {t('whiteGloveDesc')}
                  </p>
                </div>
              </div>
              <span className="font-label-caps text-[10px] text-primary font-bold">
                {t('free')}
              </span>
            </button>

            <button
              onClick={() => setShippingOption('vaultCourier')}
              className={`w-full p-3 rounded-xl text-left flex items-center justify-between transition-all ${
                shippingOption === 'vaultCourier'
                  ? 'bg-surface-container-lowest border-2 border-primary-container shadow-sm'
                  : 'bg-surface-container-lowest subtle-hairline hover:border-outline'
              }`}
              type="button"
            >
              <div className="flex items-center space-x-2.5">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  local_shipping
                </span>
                <div>
                  <p className="font-title-md text-[13px] font-semibold text-on-surface">
                    {t('vaultCourier')}
                  </p>
                  <p className="font-body-sm text-[11px] text-secondary">
                    {t('vaultCourierDesc')}
                  </p>
                </div>
              </div>
              <span className="font-label-numeric text-[12px] font-bold text-on-surface">
                {hasFreeShipping
                  ? t('free')
                  : t('vaultCourierPrice', { price: formatPrice(45, currency) })}
              </span>
            </button>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-error/10 border border-error/40 text-error font-body-sm text-[12px]"
          >
            {error}
          </div>
        )}

        <section className="bg-surface-container-lowest rounded-xl p-4 subtle-hairline space-y-2.5">
          <h3 className="font-label-caps text-[11px] text-primary uppercase tracking-widest font-bold pb-1 border-b border-outline-variant/20">
            {t('orderSummary')}
          </h3>
          <div className="flex justify-between text-xs text-secondary">
            <span>{t('subtotal')}</span>
            <span className="font-label-numeric text-on-surface font-semibold">
              {formatPrice(subtotal, currency)}
            </span>
          </div>
          <div className="flex justify-between text-xs text-secondary">
            <span>{t('shipping')}</span>
            <span className="font-label-numeric text-on-surface font-semibold">
              {shippingCost === 0 ? t('complimentary') : formatPrice(shippingCost, currency)}
            </span>
          </div>
          <div className="pt-2 border-t border-outline-variant/30 flex justify-between items-baseline">
            <span className="font-label-caps text-[11px] uppercase tracking-wider font-bold text-on-surface">
              {t('total')}
            </span>
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
              {formatPrice(total, currency)}
            </span>
          </div>
        </section>
      </main>

      <aside className="fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 dark:bg-inverse-surface/95 backdrop-blur-md border-t border-outline-variant/30 py-3.5 px-margin shadow-2xl">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <div>
            <span className="font-label-caps text-[10px] text-outline uppercase block">
              {t('finalValuation')}
            </span>
            <span className="font-headline-sm text-title-md font-bold text-on-surface">
              {formatPrice(total, currency)}
            </span>
          </div>
          <button
            onClick={() => void handlePlaceOrder()}
            disabled={(cart.length === 0 && appliedOffers.length === 0) || isPlacingOrder}
            className="flex-1 py-3 px-5 rounded-lg bg-on-surface text-surface-container-lowest border border-primary-container/60 font-label-caps text-[11px] font-bold tracking-wider flex items-center justify-center space-x-2 gold-glow-interactive active:scale-95 transition-all hover:bg-primary disabled:opacity-50 disabled:pointer-events-none"
            type="button"
          >
            <span>{isPlacingOrder ? t('placingOrder') : t('placeOrder')}</span>
            <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">
              lock
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
}
