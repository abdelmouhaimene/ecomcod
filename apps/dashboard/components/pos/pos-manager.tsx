'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
    AdminRole,
    type OrderPayload,
    type PublicOffer,
    type PublicOrder,
    type PublicOrderItem,
    type PublicStockAvailability,
} from '@repo/types';
import { AdminApiError, adminApi } from '../../lib/admin-api';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';

interface CartLine {
    key: string;
    skuId: string;
    quantity: string;
}

interface PosFormState {
    offerId: string;
    times: string;
    /** Chosen SKU per product included in the selected offer. */
    selections: Record<string, string>;
    customerName: string;
    customerEmail: string;
    notes: string;
    baseShippingCost: string;
    taxAmount: string;
}

function apiMessage(caught: unknown, fallback: string): string {
    return caught instanceof AdminApiError ? caught.message : fallback;
}

let tempKeyCounter = 0;

function nextTempKey(): string {
    tempKeyCounter += 1;
    return `pos-line-${Date.now()}-${tempKeyCounter}`;
}

function createEmptyForm(): PosFormState {
    return {
        offerId: '',
        times: '1',
        selections: {},
        customerName: '',
        customerEmail: '',
        notes: '',
        baseShippingCost: '0',
        taxAmount: '0',
    };
}

function createEmptyLine(): CartLine {
    return { key: nextTempKey(), skuId: '', quantity: '1' };
}

function parsePositiveInteger(value: string): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function parseMoney(value: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.round(parsed * 100) / 100;
}

function matchesSearch(order: PublicOrder, query: string): boolean {
    if (!query) return true;
    const values = [
        order.orderNumber,
        order.customerName ?? '',
        order.customerEmail ?? '',
        order.notes ?? '',
        ...order.items.map((item) => `${item.productName} ${item.sku} ${item.offerName ?? ''}`),
    ];
    return values.some((value) => value.toLowerCase().includes(query));
}

export function PosManager(): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();
    const canManage = admin?.role === AdminRole.SYSTEM || admin?.role === AdminRole.MANAGER;

    const [skus, setSkus] = useState<PublicStockAvailability[]>([]);
    const [offers, setOffers] = useState<PublicOffer[]>([]);
    const [optionsLoading, setOptionsLoading] = useState(false);
    const [cart, setCart] = useState<CartLine[]>(() => [createEmptyLine()]);
    const [form, setForm] = useState<PosFormState>(createEmptyForm);
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [orders, setOrders] = useState<PublicOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const loadOrders = useCallback(async () => {
        setLoading(true);
        setListError(null);
        try {
            setOrders(await adminApi.listPosOrders());
        } catch (caught) {
            setListError(apiMessage(caught, t('posLoadError')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const loadOptions = useCallback(async () => {
        setOptionsLoading(true);
        try {
            const [availability, allOffers] = await Promise.all([
                adminApi.listStockAvailability(),
                adminApi.listOffers(),
            ]);
            setSkus(availability.filter((item) => item.stockQuantity > 0));
            setOffers(allOffers.filter((offer) => offer.isActive));
        } catch (caught) {
            setFormError(apiMessage(caught, t('posLoadOptionsError')));
        } finally {
            setOptionsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadOrders();
    }, [loadOrders]);

    useEffect(() => {
        if (canManage) void loadOptions();
    }, [canManage, loadOptions]);

    const skuById = useMemo(
        () => new Map<string, PublicStockAvailability>(skus.map((sku) => [sku.skuId, sku])),
        [skus],
    );

    const skusByProduct = useMemo(() => {
        const grouped = new Map<string, PublicStockAvailability[]>();
        skus.forEach((sku) => {
            const list = grouped.get(sku.productId) ?? [];
            list.push(sku);
            grouped.set(sku.productId, list);
        });
        return grouped;
    }, [skus]);

    /** Variants already in the cart, preferred when defaulting offer selections. */
    const cartSkuByProduct = useMemo(() => {
        const byProduct = new Map<string, string>();
        for (const line of cart) {
            const sku = skuById.get(line.skuId);
            if (sku && parsePositiveInteger(line.quantity) > 0) {
                byProduct.set(sku.productId, sku.skuId);
            }
        }
        return byProduct;
    }, [cart, skuById]);

    const selectedOffer = useMemo(
        () => offers.find((offer) => offer.id === form.offerId) ?? null,
        [offers, form.offerId],
    );

    const offerProductIds = useMemo(() => {
        if (!selectedOffer) return [];
        const ids =
            selectedOffer.type === 'PACK'
                ? selectedOffer.packItems.map((item) => item.productId)
                : selectedOffer.singleRule
                  ? [selectedOffer.singleRule.productId]
                  : [];
        return Array.from(new Set(ids));
    }, [selectedOffer]);

    useEffect(() => {
        setForm((current) => {
            const next: Record<string, string> = {};
            let changed = Object.keys(current.selections).length !== offerProductIds.length;
            offerProductIds.forEach((productId) => {
                const available = skusByProduct.get(productId) ?? [];
                const selected = current.selections[productId];
                const preferred = cartSkuByProduct.get(productId);
                const skuId =
                    selected && available.some((sku) => sku.skuId === selected)
                        ? selected
                        : preferred && available.some((sku) => sku.skuId === preferred)
                          ? preferred
                          : (available[0]?.skuId ?? '');
                next[productId] = skuId;
                if (selected !== skuId) changed = true;
            });
            return changed ? { ...current, selections: next } : current;
        });
    }, [offerProductIds, skusByProduct, cartSkuByProduct]);

    const filteredOrders = useMemo(() => {
        const query = search.trim().toLowerCase();
        return orders.filter((order) => matchesSearch(order, query));
    }, [orders, search]);

    const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const numberFormatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'DZD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const formatDate = (value: string) => dateFormatter.format(new Date(value));
    const formatMoney = (value: number) => numberFormatter.format(value);

    const sourceLabel = (source: PublicOrder['source']) =>
        source === 'POS' ? t('posSourcePos') : t('posSourceWeb');

    const statusLabel = (status: PublicOrder['status']) =>
        status === 'COMPLETED' ? t('posStatusCompleted') : t('posStatusCancelled');

    const kindLabel = (kind: PublicOrderItem['kind']) => {
        if (kind === 'SINGLE_FREE') return t('posKindSingleFree');
        if (kind === 'PACK') return t('posKindPack');
        return t('posKindRegular');
    };

    const offerTypeLabel = (type: PublicOffer['type']) =>
        type === 'PACK' ? t('posOfferTypePack') : t('posOfferTypeSingle');

    const hasItems = cart.some(
        (line) => line.skuId !== '' && parsePositiveInteger(line.quantity) > 0,
    );

    const changeLine = (key: string, changes: Partial<CartLine>) => {
        setCart((current) => {
            if (changes.skuId) {
                const duplicate = current.find(
                    (line) => line.key !== key && line.skuId === changes.skuId,
                );
                if (duplicate) {
                    const source = current.find((line) => line.key === key);
                    const merged =
                        parsePositiveInteger(source?.quantity ?? '1') +
                        parsePositiveInteger(duplicate.quantity);
                    return current
                        .filter((line) => line.key !== key)
                        .map((line) =>
                            line.key === duplicate.key
                                ? { ...line, quantity: String(merged) }
                                : line,
                        );
                }
            }
            return current.map((line) =>
                line.key === key ? { ...line, ...changes } : line,
            );
        });
    };

    const addLine = () => {
        setCart((current) => [...current, createEmptyLine()]);
    };

    const removeLine = (key: string) => {
        setCart((current) => current.filter((line) => line.key !== key));
    };

    const resetForm = () => {
        setCart([createEmptyLine()]);
        setForm(createEmptyForm());
        setFormError(null);
    };

    const handleSubmit = async () => {
        setFormError(null);
        setNotice(null);

        const items = cart
            .map((line) => ({
                skuId: line.skuId,
                quantity: parsePositiveInteger(line.quantity),
            }))
            .filter((item) => item.skuId !== '' && item.quantity > 0);

        if (items.length === 0) {
            setFormError(t('posItemsRequired'));
            return;
        }

        const times = form.offerId ? parsePositiveInteger(form.times) : 0;
        if (form.offerId && times < 1) {
            setFormError(t('posTimesInvalid'));
            return;
        }

        const selections = form.offerId
            ? offerProductIds.map((productId) => {
                  const skuId = form.selections[productId] ?? '';
                  const inStock = (skusByProduct.get(productId) ?? []).some(
                      (sku) => sku.skuId === skuId,
                  );
                  return { productId, skuId: inStock ? skuId : '' };
              })
            : [];
        if (form.offerId && selections.some((selection) => selection.skuId === '')) {
            setFormError(t('posOfferSelectionRequired'));
            return;
        }

        const payload: OrderPayload = {
            source: 'POS',
            items,
            customerName: form.customerName.trim() || null,
            customerEmail: form.customerEmail.trim() || null,
            notes: form.notes.trim() || null,
            baseShippingCost: parseMoney(form.baseShippingCost),
            taxAmount: parseMoney(form.taxAmount),
        };
        if (form.offerId) {
            payload.offers = [{ offerId: form.offerId, times, selections }];
        }

        setSaving(true);
        try {
            const order = await adminApi.createPosOrder(payload);
            setNotice(`${t('posCreated')} ${order.orderNumber} · ${formatMoney(order.total)}`);
            resetForm();
            setExpandedId(order.id);
            await loadOrders();
            void loadOptions();
        } catch (caught) {
            setFormError(apiMessage(caught, t('posCreateError')));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <header className="page-heading toolbar">
                <div>
                    <h2 className="page-title">{t('posTitle')}</h2>
                    <p className="page-subtitle">{t('posSubtitle')}</p>
                </div>
                <div className="toolbar-actions">
                    <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void loadOrders()}
                        disabled={loading}
                    >
                        {t('refresh')}
                    </button>
                </div>
            </header>

            {notice ? (
                <p className="notice success" role="status">
                    {notice}
                </p>
            ) : null}
            {formError ? (
                <p className="notice error" role="alert">
                    {formError}
                </p>
            ) : null}
            {!canManage ? (
                <div className="notice info" role="note">
                    <strong className="notice-title">{t('posReadOnly')}</strong>
                </div>
            ) : null}

            {canManage ? (
                <section className="section-card narrow" aria-labelledby="pos-form-title">
                    <h3 className="section-title" id="pos-form-title">
                        {t('posNewSale')}
                    </h3>
                    <p className="section-description">{t('posSubtitle')}</p>

                    <div className="form-stack compact">
                        <div className="toolbar">
                            <h4 className="section-title">{t('lineItems')}</h4>
                            <button
                                type="button"
                                className="button secondary small"
                                onClick={addLine}
                            >
                                {t('addLine')}
                            </button>
                        </div>

                        {cart.length === 0 ? (
                            <p className="state-text">{t('posLinesEmpty')}</p>
                        ) : null}

                        {cart.map((line, index) => {
                            const stock = skuById.get(line.skuId);
                            const exceeds =
                                stock !== undefined &&
                                parsePositiveInteger(line.quantity) > stock.stockQuantity;
                            return (
                                <div className="line-item-row" key={line.key}>
                                    <span className="line-index">{index + 1}</span>
                                    <select
                                        className="field-input"
                                        aria-label={`${t('posSku')} ${index + 1}`}
                                        value={line.skuId}
                                        onChange={(event) =>
                                            changeLine(line.key, { skuId: event.target.value })
                                        }
                                    >
                                        <option value="">{t('posSelectSku')}</option>
                                        {skus.map((sku) => (
                                            <option key={sku.skuId} value={sku.skuId}>
                                                {sku.productName} — {sku.label} ({sku.sku}) ·{' '}
                                                {sku.stockQuantity} {t('posAvailable')}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        className="field-input field-number"
                                        aria-label={`${t('columnQuantity')} ${index + 1}`}
                                        value={line.quantity}
                                        onChange={(event) =>
                                            changeLine(line.key, { quantity: event.target.value })
                                        }
                                    />
                                    <span className="muted">
                                        {stock ? `${stock.stockQuantity} ${t('posAvailable')}` : '—'}
                                    </span>
                                    <span className="muted">{exceeds ? t('posStockWarning') : null}</span>
                                    <button
                                        type="button"
                                        className="button danger small line-item-actions"
                                        onClick={() => removeLine(line.key)}
                                        aria-label={`${t('removeLine')} ${index + 1}`}
                                    >
                                        {t('removeLine')}
                                    </button>
                                </div>
                            );
                        })}

                        <div className="field-grid">
                            <div className="field">
                                <label className="field-label" htmlFor="pos-offer">
                                    {t('posOffer')}
                                </label>
                                <select
                                    id="pos-offer"
                                    className="field-input"
                                    value={form.offerId}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            offerId: event.target.value,
                                            selections: {},
                                        }))
                                    }
                                >
                                    <option value="">{t('posNoOffer')}</option>
                                    {offers.map((offer) => (
                                        <option key={offer.id} value={offer.id}>
                                            {offer.name} — {offerTypeLabel(offer.type)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="field">
                                <label className="field-label" htmlFor="pos-times">
                                    {t('posTimes')}
                                </label>
                                <input
                                    id="pos-times"
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="field-input field-number"
                                    value={form.times}
                                    disabled={!form.offerId}
                                    onChange={(event) =>
                                        setForm((current) => ({ ...current, times: event.target.value }))
                                    }
                                />
                            </div>
                        </div>
                        <p className="muted">{t('posOfferNote')}</p>

                        {offerProductIds.length > 0 ? (
                            <div className="form-stack compact">
                                <h4 className="section-title">{t('posOfferVariants')}</h4>
                                <div className="field-grid">
                                    {offerProductIds.map((productId) => {
                                        const availableSkus = skusByProduct.get(productId) ?? [];
                                        const productName = availableSkus[0]?.productName ?? productId;
                                        return (
                                            <div className="field" key={productId}>
                                                <label
                                                    className="field-label"
                                                    htmlFor={`pos-offer-variant-${productId}`}
                                                >
                                                    {productName}
                                                </label>
                                                <select
                                                    id={`pos-offer-variant-${productId}`}
                                                    className="field-input"
                                                    value={form.selections[productId] ?? ''}
                                                    onChange={(event) =>
                                                        setForm((current) => ({
                                                            ...current,
                                                            selections: {
                                                                ...current.selections,
                                                                [productId]: event.target.value,
                                                            },
                                                        }))
                                                    }
                                                >
                                                    <option value="">{t('posSelectSku')}</option>
                                                    {availableSkus.map((sku) => (
                                                        <option key={sku.skuId} value={sku.skuId}>
                                                            {sku.label || sku.sku} ({sku.sku}) ·{' '}
                                                            {sku.stockQuantity} {t('posAvailable')}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        <div className="field-grid">
                            <div className="field">
                                <label className="field-label" htmlFor="pos-customer-name">
                                    {t('fullName')}
                                </label>
                                <input
                                    id="pos-customer-name"
                                    className="field-input"
                                    value={form.customerName}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            customerName: event.target.value,
                                        }))
                                    }
                                    autoComplete="off"
                                />
                            </div>
                            <div className="field">
                                <label className="field-label" htmlFor="pos-customer-email">
                                    {t('email')}
                                </label>
                                <input
                                    id="pos-customer-email"
                                    type="email"
                                    className="field-input"
                                    value={form.customerEmail}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            customerEmail: event.target.value,
                                        }))
                                    }
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        <div className="field">
                            <label className="field-label" htmlFor="pos-notes">
                                {t('posNotes')}
                            </label>
                            <textarea
                                id="pos-notes"
                                className="field-input"
                                value={form.notes}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, notes: event.target.value }))
                                }
                            />
                        </div>

                        <div className="field-grid">
                            <div className="field">
                                <label className="field-label" htmlFor="pos-shipping">
                                    {t('posBaseShipping')}
                                </label>
                                <input
                                    id="pos-shipping"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="field-input field-number"
                                    value={form.baseShippingCost}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            baseShippingCost: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="field">
                                <label className="field-label" htmlFor="pos-tax">
                                    {t('posTax')}
                                </label>
                                <input
                                    id="pos-tax"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="field-input field-number"
                                    value={form.taxAmount}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            taxAmount: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="button primary"
                                onClick={() => void handleSubmit()}
                                disabled={saving || !hasItems || optionsLoading}
                            >
                                {saving ? t('saving') : t('posCreate')}
                            </button>
                        </div>
                    </div>
                </section>
            ) : null}

            <section className="section-card table-card" aria-labelledby="pos-orders-title">
                <h3 className="section-title" id="pos-orders-title">
                    {t('posOrders')}
                </h3>

                <div className="table-toolbar">
                    <input
                        type="search"
                        className="field-input search-input"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('posSearch')}
                        aria-label={t('posSearch')}
                    />
                    <span className="stat-note">
                        {t('posShowing')} {filteredOrders.length} / {orders.length}
                    </span>
                </div>

                {loading ? (
                    <div className="center-state">
                        <span className="state-spinner" aria-hidden="true" />
                        <p className="state-text">{t('posLoading')}</p>
                    </div>
                ) : listError ? (
                    <div className="empty-state">
                        <p className="state-text">{listError}</p>
                        <button
                            type="button"
                            className="button secondary small"
                            onClick={() => void loadOrders()}
                        >
                            {t('retry')}
                        </button>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('posEmpty')}</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('posNoResults')}</p>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t('posColumnOrder')}</th>
                                    <th scope="col">{t('columnEntryDate')}</th>
                                    <th scope="col">{t('posColumnSource')}</th>
                                    <th scope="col">{t('posColumnCustomer')}</th>
                                    <th scope="col">{t('posColumnItems')}</th>
                                    <th scope="col">{t('columnTotal')}</th>
                                    <th scope="col">{t('status')}</th>
                                    <th scope="col">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map((order) => {
                                    const expanded = expandedId === order.id;
                                    const totalQuantity = order.items.reduce(
                                        (sum, item) => sum + item.quantity,
                                        0,
                                    );
                                    return (
                                        <Fragment key={order.id}>
                                            <tr>
                                                <td>
                                                    <strong className="table-ref">
                                                        {order.orderNumber}
                                                    </strong>
                                                </td>
                                                <td className="muted">{formatDate(order.createdAt)}</td>
                                                <td>
                                                    <span className="chip">
                                                        {sourceLabel(order.source)}
                                                    </span>
                                                </td>
                                                <td>
                                                    {order.customerName ? (
                                                        <strong>{order.customerName}</strong>
                                                    ) : (
                                                        <span className="muted">—</span>
                                                    )}
                                                    {order.customerEmail ? (
                                                        <div className="muted">
                                                            {order.customerEmail}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td>
                                                    <strong>{totalQuantity}</strong>
                                                    <div className="muted">
                                                        {order.items.length} {t('lineItems')}
                                                    </div>
                                                </td>
                                                <td>
                                                    <strong>{formatMoney(order.total)}</strong>
                                                </td>
                                                <td>
                                                    <span className="chip">
                                                        {statusLabel(order.status)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="button secondary small"
                                                        onClick={() =>
                                                            setExpandedId((current) =>
                                                                current === order.id ? null : order.id,
                                                            )
                                                        }
                                                        aria-expanded={expanded}
                                                    >
                                                        {expanded ? t('posHideDetails') : t('posDetails')}
                                                    </button>
                                                </td>
                                            </tr>
                                            {expanded ? (
                                                <tr>
                                                    <td colSpan={8}>
                                                        <div className="form-stack compact">
                                                            <div className="table-scroll">
                                                                <table className="data-table">
                                                                    <thead>
                                                                        <tr>
                                                                            <th scope="col">
                                                                                {t('columnName')}
                                                                            </th>
                                                                            <th scope="col">{t('posSku')}</th>
                                                                            <th scope="col">{t('posKind')}</th>
                                                                            <th scope="col">
                                                                                {t('columnQuantity')}
                                                                            </th>
                                                                            <th scope="col">
                                                                                {t('columnUnitPrice')}
                                                                            </th>
                                                                            <th scope="col">
                                                                                {t('columnLineTotal')}
                                                                            </th>
                                                                            <th scope="col">{t('posOffer')}</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {order.items.map(
                                                                            (item: PublicOrderItem) => (
                                                                                <tr key={item.id}>
                                                                                    <td>
                                                                                        {item.productName}
                                                                                    </td>
                                                                                    <td className="muted">
                                                                                        {item.sku}
                                                                                    </td>
                                                                                    <td>
                                                                                        <span className="chip">
                                                                                            {kindLabel(
                                                                                                item.kind,
                                                                                            )}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td>{item.quantity}</td>
                                                                                    <td>
                                                                                        {formatMoney(
                                                                                            item.unitPrice,
                                                                                        )}
                                                                                    </td>
                                                                                    <td>
                                                                                        {formatMoney(
                                                                                            item.lineTotal,
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="muted">
                                                                                        {item.offerName ?? '—'}
                                                                                    </td>
                                                                                </tr>
                                                                            ),
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>

                                                            <div className="field-grid">
                                                                <div className="field">
                                                                    <span className="field-label">
                                                                        {t('posSubtotal')}
                                                                    </span>
                                                                    <span>
                                                                        {formatMoney(order.subtotal)}
                                                                    </span>
                                                                </div>
                                                                <div className="field">
                                                                    <span className="field-label">
                                                                        {t('posDiscount')}
                                                                    </span>
                                                                    <span>
                                                                        {formatMoney(order.discount)}
                                                                    </span>
                                                                </div>
                                                                <div className="field">
                                                                    <span className="field-label">
                                                                        {t('posShipping')}
                                                                    </span>
                                                                    <span>
                                                                        {formatMoney(order.shippingCost)}
                                                                    </span>
                                                                </div>
                                                                <div className="field">
                                                                    <span className="field-label">
                                                                        {t('posTax')}
                                                                    </span>
                                                                    <span>
                                                                        {formatMoney(order.taxAmount)}
                                                                    </span>
                                                                </div>
                                                                <div className="field">
                                                                    <span className="field-label">
                                                                        {t('columnTotal')}
                                                                    </span>
                                                                    <strong>
                                                                        {formatMoney(order.total)}
                                                                    </strong>
                                                                </div>
                                                            </div>

                                                            {order.freeShipping ? (
                                                                <p>
                                                                    <span className="chip">
                                                                        {t('posFreeShipping')}
                                                                    </span>
                                                                </p>
                                                            ) : null}
                                                            {order.notes ? (
                                                                <p className="muted">{order.notes}</p>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </>
    );
}
