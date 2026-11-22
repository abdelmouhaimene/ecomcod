'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AdminRole,
    type OfferPayload,
    type OfferType,
    type PublicOffer,
    type PublicProduct,
    type SingleOfferMode,
} from '@repo/types';
import { AdminApiError, adminApi } from '../../lib/admin-api';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';

interface PackItemDraft {
    key: string;
    productId: string;
    quantity: string;
}

interface OfferFormState {
    name: string;
    type: OfferType;
    isActive: boolean;
    startsAt: string;
    endsAt: string;
    mode: SingleOfferMode;
    productId: string;
    buyQuantity: string;
    freeQuantity: string;
    packPrice: string;
    packItems: PackItemDraft[];
}

function apiMessage(caught: unknown, fallback: string): string {
    return caught instanceof AdminApiError ? caught.message : fallback;
}

let tempKeyCounter = 0;

function nextTempKey(prefix: string): string {
    tempKeyCounter += 1;
    return `${prefix}-temp-${Date.now()}-${tempKeyCounter}`;
}

function createEmptyForm(): OfferFormState {
    return {
        name: '',
        type: 'SINGLE_PRODUCT',
        isActive: true,
        startsAt: '',
        endsAt: '',
        mode: 'BUY_X_GET_Y_FREE',
        productId: '',
        buyQuantity: '1',
        freeQuantity: '1',
        packPrice: '',
        packItems: [{ key: nextTempKey('pack'), productId: '', quantity: '1' }],
    };
}

/** ISO wire value to the local value expected by `<input type="datetime-local">`. */
function toDateTimeLocal(iso: string | null): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function offerToForm(offer: PublicOffer): OfferFormState {
    return {
        name: offer.name,
        type: offer.type,
        isActive: offer.isActive,
        startsAt: toDateTimeLocal(offer.startsAt),
        endsAt: toDateTimeLocal(offer.endsAt),
        mode: offer.singleRule?.mode ?? 'BUY_X_GET_Y_FREE',
        productId: offer.singleRule?.productId ?? '',
        buyQuantity: offer.singleRule ? String(offer.singleRule.buyQuantity) : '1',
        freeQuantity:
            offer.singleRule === null || offer.singleRule.freeQuantity === null
                ? '1'
                : String(offer.singleRule.freeQuantity),
        packPrice: offer.packPrice === null ? '' : String(offer.packPrice),
        packItems: offer.packItems.map((item) => ({
            key: item.id,
            productId: item.productId,
            quantity: String(item.quantity),
        })),
    };
}

function isPositiveInteger(value: string): boolean {
    return /^\d+$/.test(value.trim()) && Number(value) > 0;
}

function isMoney(value: string): boolean {
    const trimmed = value.trim();
    return /^\d+(\.\d{1,2})?$/.test(trimmed) && Number.isFinite(Number(trimmed));
}

function isDateTimeValid(value: string): boolean {
    if (!value) return true;
    return !Number.isNaN(new Date(value).getTime());
}

function areDatesValid(start: string, end: string): boolean {
    if (!isDateTimeValid(start) || !isDateTimeValid(end)) return false;
    if (!start || !end) return true;
    return new Date(end).getTime() > new Date(start).getTime();
}

export function OfferManager(): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();
    const canManage =
        admin?.role === AdminRole.SYSTEM || admin?.role === AdminRole.MANAGER;

    const [offers, setOffers] = useState<PublicOffer[]>([]);
    const [products, setProducts] = useState<PublicProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
    const [form, setForm] = useState<OfferFormState>(createEmptyForm);
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadOffers = useCallback(async () => {
        setLoading(true);
        setListError(null);
        try {
            const [offerList, productList] = await Promise.all([
                adminApi.listOffers(),
                adminApi.listProducts(),
            ]);
            setOffers(offerList);
            setProducts(productList);
        } catch (caught) {
            setListError(apiMessage(caught, t('loadOffersError')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadOffers();
    }, [loadOffers]);

    const productLabelById = useMemo(
        () => new Map(products.map((product) => [product.id, `${product.ref} — ${product.name}`])),
        [products],
    );

    const productLabel = (id: string) => productLabelById.get(id) ?? id;

    const filteredOffers = useMemo(() => {
        const query = search.trim().toLowerCase();
        return offers.filter((offer) => {
            if (!query) return true;
            const typeLabel = offer.type === 'PACK' ? t('offerTypePack') : t('offerTypeSingle');
            return [offer.name, offer.type, typeLabel].some((value) =>
                value.toLowerCase().includes(query),
            );
        });
    }, [offers, search, t]);

    const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const priceFormatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const formatDate = (value: string) => dateFormatter.format(new Date(value));

    const resetForm = () => {
        setEditingId(null);
        setForm(createEmptyForm());
        setFormError(null);
    };

    const startEdit = async (offer: PublicOffer) => {
        setNotice(null);
        setFormError(null);
        setConfirmId(null);
        setLoadingEditId(offer.id);
        try {
            const fresh = await adminApi.getOffer(offer.id);
            setEditingId(fresh.id);
            setForm(offerToForm(fresh));
        } catch (caught) {
            setFormError(apiMessage(caught, t('loadOffersError')));
        } finally {
            setLoadingEditId(null);
        }
    };

    const changePackItem = (key: string, changes: Partial<PackItemDraft>) => {
        setForm((current) => ({
            ...current,
            packItems: current.packItems.map((item) =>
                item.key === key ? { ...item, ...changes } : item,
            ),
        }));
    };

    const addPackItem = () => {
        setForm((current) => ({
            ...current,
            packItems: [
                ...current.packItems,
                { key: nextTempKey('pack'), productId: '', quantity: '1' },
            ],
        }));
    };

    const removePackItem = (key: string) => {
        setForm((current) => ({
            ...current,
            packItems: current.packItems.filter((item) => item.key !== key),
        }));
    };

    const handleSave = async () => {
        setFormError(null);
        setNotice(null);

        const name = form.name.trim();
        if (!name) {
            setFormError(t('nameRequired'));
            return;
        }
        if (!areDatesValid(form.startsAt, form.endsAt)) {
            setFormError(t('offerDatesInvalid'));
            return;
        }

        let payload: OfferPayload;
        if (form.type === 'SINGLE_PRODUCT') {
            if (!form.productId) {
                setFormError(t('offerSingleRequired'));
                return;
            }
            if (
                !isPositiveInteger(form.buyQuantity) ||
                (form.mode === 'BUY_X_GET_Y_FREE' && !isPositiveInteger(form.freeQuantity))
            ) {
                setFormError(t('offerQuantityInvalid'));
                return;
            }
            payload = {
                name,
                type: 'SINGLE_PRODUCT',
                isActive: form.isActive,
                startsAt: toIsoOrNull(form.startsAt),
                endsAt: toIsoOrNull(form.endsAt),
                singleRule: {
                    productId: form.productId,
                    mode: form.mode,
                    buyQuantity: Number(form.buyQuantity),
                    freeQuantity:
                        form.mode === 'BUY_X_GET_Y_FREE' ? Number(form.freeQuantity) : null,
                },
                packItems: [],
            };
        } else {
            if (!isMoney(form.packPrice) || Number(form.packPrice) < 0.01) {
                setFormError(t('offerPackPriceInvalid'));
                return;
            }
            const packProductIds = form.packItems.map((item) => item.productId);
            if (
                form.packItems.length === 0 ||
                form.packItems.some(
                    (item) => !item.productId || !isPositiveInteger(item.quantity),
                ) ||
                new Set(packProductIds).size !== packProductIds.length
            ) {
                setFormError(t('offerPackItemsInvalid'));
                return;
            }
            payload = {
                name,
                type: 'PACK',
                isActive: form.isActive,
                startsAt: toIsoOrNull(form.startsAt),
                endsAt: toIsoOrNull(form.endsAt),
                packPrice: Number(form.packPrice),
                singleRule: null,
                packItems: form.packItems.map((item) => ({
                    productId: item.productId,
                    quantity: Number(item.quantity),
                })),
            };
        }

        setSaving(true);
        try {
            if (editingId !== null) {
                await adminApi.updateOffer(editingId, payload);
                setNotice(t('offerUpdated'));
            } else {
                await adminApi.createOffer(payload);
                setNotice(t('offerCreated'));
            }
            resetForm();
            await loadOffers();
        } catch (caught) {
            setFormError(
                apiMessage(caught, t(editingId === null ? 'createOfferError' : 'updateOfferError')),
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (offer: PublicOffer) => {
        setFormError(null);
        setNotice(null);
        setDeletingId(offer.id);
        try {
            await adminApi.removeOffer(offer.id);
            setOffers((current) => current.filter((item) => item.id !== offer.id));
            if (editingId === offer.id) resetForm();
            setConfirmId(null);
            setNotice(t('offerDeleted'));
        } catch (caught) {
            setFormError(apiMessage(caught, t('deleteOfferError')));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <header className="page-heading toolbar">
                <div>
                    <h2 className="page-title">{t('offersTitle')}</h2>
                    <p className="page-subtitle">{t('offersSubtitle')}</p>
                </div>
                <div className="toolbar-actions">
                    <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void loadOffers()}
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
                    <strong className="notice-title">{t('catalogReadOnlyTitle')}</strong>
                    <span>{t('catalogReadOnlyDescription')}</span>
                </div>
            ) : null}

            {canManage ? (
                <section className="section-card narrow" aria-labelledby="offer-form-title">
                    <h3 className="section-title" id="offer-form-title">
                        {editingId === null ? t('createOffer') : t('editOffer')}
                    </h3>
                    <p className="section-description">{t('offersSubtitle')}</p>

                    <div className="form-stack compact">
                        <div className="field">
                            <label className="field-label" htmlFor="offer-name">
                                {t('name')}
                            </label>
                            <input
                                id="offer-name"
                                className="field-input"
                                value={form.name}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, name: event.target.value }))
                                }
                                autoComplete="off"
                            />
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="offer-type">
                                {t('offerType')}
                            </label>
                            <select
                                id="offer-type"
                                className="field-input"
                                value={form.type}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        type: event.target.value as OfferType,
                                    }))
                                }
                            >
                                <option value="SINGLE_PRODUCT">{t('offerTypeSingle')}</option>
                                <option value="PACK">{t('offerTypePack')}</option>
                            </select>
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="offer-active">
                                <input
                                    id="offer-active"
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            isActive: event.target.checked,
                                        }))
                                    }
                                />
                                {t('active')}
                            </label>
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="offer-starts-at">
                                {t('offerStartsAt')}
                            </label>
                            <input
                                id="offer-starts-at"
                                type="datetime-local"
                                className="field-input"
                                value={form.startsAt}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        startsAt: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="offer-ends-at">
                                {t('offerEndsAt')}
                            </label>
                            <input
                                id="offer-ends-at"
                                type="datetime-local"
                                className="field-input"
                                value={form.endsAt}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        endsAt: event.target.value,
                                    }))
                                }
                            />
                        </div>

                        {form.type === 'SINGLE_PRODUCT' ? (
                            <>
                                <div className="field">
                                    <label className="field-label" htmlFor="offer-product">
                                        {t('filterProduct')}
                                    </label>
                                    <select
                                        id="offer-product"
                                        className="field-input"
                                        value={form.productId}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                productId: event.target.value,
                                            }))
                                        }
                                    >
                                        <option value="">{t('filterProduct')}</option>
                                        {products.map((product) => (
                                            <option key={product.id} value={product.id}>
                                                {productLabel(product.id)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="field">
                                    <label className="field-label" htmlFor="offer-mode">
                                        {t('offerMode')}
                                    </label>
                                    <select
                                        id="offer-mode"
                                        className="field-input"
                                        value={form.mode}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                mode: event.target.value as SingleOfferMode,
                                            }))
                                        }
                                    >
                                        <option value="BUY_X_GET_Y_FREE">
                                            {t('offerModeBuyXGetYFree')}
                                        </option>
                                        <option value="BUY_X_GET_FREE_SHIPPING">
                                            {t('offerModeFreeShipping')}
                                        </option>
                                    </select>
                                </div>
                                <div className="field">
                                    <label className="field-label" htmlFor="offer-buy-quantity">
                                        {t('offerBuyQuantity')}
                                    </label>
                                    <input
                                        id="offer-buy-quantity"
                                        type="number"
                                        min="1"
                                        step="1"
                                        className="field-input"
                                        value={form.buyQuantity}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                buyQuantity: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                {form.mode === 'BUY_X_GET_Y_FREE' ? (
                                    <div className="field">
                                        <label className="field-label" htmlFor="offer-free-quantity">
                                            {t('offerFreeQuantity')}
                                        </label>
                                        <input
                                            id="offer-free-quantity"
                                            type="number"
                                            min="1"
                                            step="1"
                                            className="field-input"
                                            value={form.freeQuantity}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    freeQuantity: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                ) : null}
                            </>
                        ) : null}

                        {form.type === 'PACK' ? (
                            <>
                                <div className="field">
                                    <label className="field-label" htmlFor="offer-pack-price">
                                        {t('offerPackPrice')}
                                    </label>
                                    <input
                                        id="offer-pack-price"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        className="field-input"
                                        value={form.packPrice}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                packPrice: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="field">
                                    <h4 className="section-title">{t('lineItems')}</h4>
                                    <button
                                        type="button"
                                        className="button secondary small"
                                        onClick={addPackItem}
                                    >
                                        {t('addLine')}
                                    </button>
                                </div>
                                {form.packItems.map((item, index) => (
                                    <div className="variant-row" key={item.key}>
                                        <div className="field">
                                            <label
                                                className="field-label"
                                                htmlFor={`pack-product-${item.key}`}
                                            >
                                                {t('filterProduct')} {index + 1}
                                            </label>
                                            <select
                                                id={`pack-product-${item.key}`}
                                                className="field-input"
                                                value={item.productId}
                                                onChange={(event) =>
                                                    changePackItem(item.key, {
                                                        productId: event.target.value,
                                                    })
                                                }
                                            >
                                                <option value="">{t('filterProduct')}</option>
                                                {products.map((product) => (
                                                    <option key={product.id} value={product.id}>
                                                        {productLabel(product.id)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="field">
                                            <label
                                                className="field-label"
                                                htmlFor={`pack-quantity-${item.key}`}
                                            >
                                                {t('columnQuantity')}
                                            </label>
                                            <input
                                                id={`pack-quantity-${item.key}`}
                                                type="number"
                                                min="1"
                                                step="1"
                                                className="field-input"
                                                value={item.quantity}
                                                onChange={(event) =>
                                                    changePackItem(item.key, {
                                                        quantity: event.target.value,
                                                    })
                                                }
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            className="button danger small"
                                            onClick={() => removePackItem(item.key)}
                                            aria-label={`${t('removeLine')} ${index + 1}`}
                                        >
                                            {t('removeLine')}
                                        </button>
                                    </div>
                                ))}
                            </>
                        ) : null}

                        <div className="form-actions">
                            {editingId !== null ? (
                                <button type="button" className="button secondary" onClick={resetForm}>
                                    {t('cancel')}
                                </button>
                            ) : null}
                            <button
                                type="button"
                                className="button primary"
                                onClick={() => void handleSave()}
                                disabled={saving}
                            >
                                {saving ? t('saving') : t('save')}
                            </button>
                        </div>
                    </div>
                </section>
            ) : null}

            <section className="section-card table-card" aria-labelledby="offer-list-title">
                <h3 className="section-title" id="offer-list-title">
                    {t('totalOffers')}
                </h3>

                <div className="table-toolbar">
                    <input
                        type="search"
                        className="field-input search-input"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('searchOffers')}
                        aria-label={t('searchOffers')}
                    />
                    <span className="stat-note">
                        {t('showingOffers')} {filteredOffers.length} / {offers.length}
                    </span>
                </div>

                {loading ? (
                    <div className="center-state">
                        <span className="state-spinner" aria-hidden="true" />
                        <p className="state-text">{t('loadingOffers')}</p>
                    </div>
                ) : listError ? (
                    <div className="empty-state">
                        <p className="state-text">{listError}</p>
                        <button
                            type="button"
                            className="button secondary small"
                            onClick={() => void loadOffers()}
                        >
                            {t('retry')}
                        </button>
                    </div>
                ) : offers.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('offersEmpty')}</p>
                    </div>
                ) : filteredOffers.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('noOfferResults')}</p>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t('columnName')}</th>
                                    <th scope="col">{t('offerType')}</th>
                                    <th scope="col">{t('status')}</th>
                                    <th scope="col">{t('offerStartsAt')}</th>
                                    <th scope="col">{t('offerEndsAt')}</th>
                                    {canManage ? <th scope="col">{t('actions')}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOffers.map((offer) => (
                                    <tr key={offer.id}>
                                        <td>
                                            <strong>{offer.name}</strong>
                                            {offer.type === 'SINGLE_PRODUCT' && offer.singleRule ? (
                                                <>
                                                    <div className="muted">
                                                        {t('filterProduct')}: {productLabel(offer.singleRule.productId)}
                                                    </div>
                                                    <div className="muted">
                                                        {offer.singleRule.mode === 'BUY_X_GET_Y_FREE'
                                                            ? `${t('offerBuyQuantity')} ${offer.singleRule.buyQuantity} · ${t('offerFreeQuantity')} ${offer.singleRule.freeQuantity ?? 0}`
                                                            : t('offerModeFreeShipping')}
                                                    </div>
                                                </>
                                            ) : null}
                                            {offer.type === 'PACK' ? (
                                                <>
                                                    <div className="muted">
                                                        {t('offerPackPrice')}:{' '}
                                                        {priceFormatter.format(offer.packPrice ?? 0)}
                                                    </div>
                                                    {offer.packItems.map((item) => (
                                                        <div className="muted" key={item.id}>
                                                            {productLabel(item.productId)} ×{' '}
                                                            {item.quantity}
                                                        </div>
                                                    ))}
                                                </>
                                            ) : null}
                                        </td>
                                        <td>
                                            {offer.type === 'PACK'
                                                ? t('offerTypePack')
                                                : t('offerTypeSingle')}
                                        </td>
                                        <td>
                                            <span className={offer.isActive ? 'chip selected' : 'chip'}>
                                                {offer.isActive ? t('active') : t('inactive')}
                                            </span>
                                        </td>
                                        <td className="muted">
                                            {offer.startsAt ? formatDate(offer.startsAt) : t('never')}
                                        </td>
                                        <td className="muted">
                                            {offer.endsAt ? formatDate(offer.endsAt) : t('never')}
                                        </td>
                                        {canManage ? (
                                            <td>
                                                {confirmId === offer.id ? (
                                                    <div className="inline-confirm">
                                                        <span className="confirm-text">
                                                            {t('confirmDeleteOffer')}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => void handleDelete(offer)}
                                                            disabled={deletingId === offer.id}
                                                        >
                                                            {deletingId === offer.id
                                                                ? t('deleting')
                                                                : t('delete')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button secondary small"
                                                            onClick={() => setConfirmId(null)}
                                                        >
                                                            {t('cancel')}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="inline-confirm">
                                                        <button
                                                            type="button"
                                                            className="button secondary small"
                                                            onClick={() => void startEdit(offer)}
                                                            disabled={loadingEditId === offer.id}
                                                        >
                                                            {t('edit')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => setConfirmId(offer.id)}
                                                        >
                                                            {t('delete')}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        ) : null}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </>
    );
}
