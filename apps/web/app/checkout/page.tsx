'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useStore } from '../../context/store-context';
import { ApiError, catalogApi } from '../../lib/api';
import { formatPrice } from '../../lib/catalog';

type ShippingOption = 'whiteGlove' | 'vaultCourier';
type PaymentOption = 'applePay' | 'creditCard' | 'conciergeInvoice';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CheckoutPage() {
  const t = useTranslations('checkout');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { cart, updateQuantity, removeFromCart, clearCart, subtotal, totalCount } = useStore();

  const [shippingOption, setShippingOption] = React.useState<ShippingOption>('whiteGlove');
  const [paymentOption, setPaymentOption] = React.useState<PaymentOption>('applePay');
  const [customerName, setCustomerName] = React.useState('');
  const [customerEmail, setCustomerEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = React.useState(false);

  const currency = tCommon('currency');
  const shippingCost = shippingOption === 'vaultCourier' ? 45 : 0;
  const vaultInsurance = 25;
  const tax = Math.round(subtotal * 0.08);
  const total = subtotal + shippingCost + vaultInsurance + tax;

  const paymentOptions = React.useMemo<
    Array<{ id: PaymentOption; label: string; icon: string }>
  >(
    () => [
      { id: 'applePay', label: t('applePay'), icon: 'fingerprint' },
      { id: 'creditCard', label: t('creditCard'), icon: 'credit_card' },
      { id: 'conciergeInvoice', label: t('conciergeInvoice'), icon: 'account_balance' },
    ],
    [t]
  );
  const selectedPaymentLabel =
    paymentOptions.find((option) => option.id === paymentOption)?.label ?? '';

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
    if (cart.length === 0 || isPlacingOrder) return;

    const name = customerName.trim();
    const email = customerEmail.trim();
    if (!name) {
      setError(t('nameRequired'));
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setError(t('emailInvalid'));
      return;
    }

    setIsPlacingOrder(true);
    setError(null);

    try {
      const order = await catalogApi.createOrder({
        source: 'WEB',
        items: cart.map((item) => ({ skuId: item.skuId, quantity: item.quantity })),
        customerName: name,
        customerEmail: email,
        notes: t('paymentNote', { method: selectedPaymentLabel }),
        baseShippingCost: shippingCost,
        taxAmount: tax + vaultInsurance,
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
      <header className="sticky top-0 z-50 bg-surface/85 backdrop-blur-md border-b border-outline-variant/30">
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

          {cart.length === 0 ? (
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
                className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant/50 text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-primary-container"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-label-caps text-[10px] text-on-surface uppercase tracking-wider">
                {t('customerEmail')}
              </span>
              <input
                type="email"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                placeholder={t('emailPlaceholder')}
                autoComplete="email"
                disabled={isPlacingOrder}
                className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant/50 text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-primary-container"
              />
            </label>
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
                {t('vaultCourierPrice', { price: formatPrice(45, currency) })}
              </span>
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-label-caps text-[11px] text-primary uppercase tracking-widest font-bold">
            {t('paymentMethod')}
          </h3>
          <div className="space-y-2">
            {paymentOptions.map((option) => {
              const isSelected = paymentOption === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => setPaymentOption(option.id)}
                  className={`w-full p-3 rounded-xl text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-surface-container-lowest border-2 border-primary-container shadow-sm'
                      : 'bg-surface-container-lowest subtle-hairline hover:border-outline'
                  }`}
                  type="button"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="material-symbols-outlined text-primary text-[20px]">
                      {option.icon}
                    </span>
                    <span className="font-title-md text-[13px] font-semibold text-on-surface">
                      {option.label}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      check_circle
                    </span>
                  )}
                </button>
              );
            })}
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
            <span>{t('vaultInsurance')}</span>
            <span className="font-label-numeric text-on-surface font-semibold">
              {formatPrice(vaultInsurance, currency)}
            </span>
          </div>
          <div className="flex justify-between text-xs text-secondary">
            <span>{t('shipping')}</span>
            <span className="font-label-numeric text-on-surface font-semibold">
              {shippingCost === 0 ? t('complimentary') : formatPrice(shippingCost, currency)}
            </span>
          </div>
          <div className="flex justify-between text-xs text-secondary">
            <span>{t('tax')}</span>
            <span className="font-label-numeric text-on-surface font-semibold">
              {formatPrice(tax, currency)}
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
            disabled={cart.length === 0 || isPlacingOrder}
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
