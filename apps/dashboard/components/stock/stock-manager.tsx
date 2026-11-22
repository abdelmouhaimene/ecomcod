'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AdminRole,
    type PublicProduct,
    type PublicProductSku,
    type PublicStockAvailability,
    type PublicStockEntry,
    type PublicSupplier,
    type StockEntryFilter,
} from '@repo/types';
import { AdminApiError, adminApi } from '../../lib/admin-api';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';

interface CombinationDraft {
    skuId: string;
    quantity: string;
}

interface LineDraft {
    key: string;
    productId: string;
    buyingPrice: string;
    totalQuantity: string;
    combinations: CombinationDraft[];
}

interface StockFormState {
    date: string;
    supplierId: string;
    lines: LineDraft[];
}

function apiMessage(caught: unknown, fallback: string): string {
    return caught instanceof AdminApiError ? caught.message : fallback;
}

let tempKeyCounter = 0;

function nextTempKey(): string {
    tempKeyCounter += 1;
    return `line-temp-${Date.now()}-${tempKeyCounter}`;
}

function activeSkus(product: PublicProduct | undefined): PublicProductSku[] {
    return (product?.skus ?? []).filter((sku) => sku.isActive);
}

function makeLine(product: PublicProduct | undefined = undefined): LineDraft {
    return {
        key: nextTempKey(),
        productId: product?.id ?? '',
        buyingPrice: '',
        totalQuantity: '1',
        combinations: activeSkus(product).map((sku) => ({ skuId: sku.id, quantity: '0' })),
    };
}

function createEmptyForm(supplierId = ''): StockFormState {
    return {
        date: new Date().toISOString().slice(0, 10),
        supplierId,
        lines: [makeLine()],
    };
}

function isPositiveInteger(value: string): boolean {
    return /^\d+$/.test(value.trim()) && Number(value) > 0;
}

function isNonNegativeInteger(value: string): boolean {
    return /^\d+$/.test(value.trim());
}

function isMoney(value: string): boolean {
    const trimmed = value.trim();
    return /^\d+(\.\d{1,2})?$/.test(trimmed) && Number.isFinite(Number(trimmed));
}

function buildYearOptions(startYear = 2026): string[] {
    const currentYear = new Date().getFullYear();
    if (currentYear < startYear) return [];
    return Array.from({ length: currentYear - startYear + 1 }, (_, index) => String(startYear + index));
}

function combinationSum(line: LineDraft): number {
    return line.combinations.reduce((sum, combination) => {
        return sum + (isNonNegativeInteger(combination.quantity) ? Number(combination.quantity) : 0);
    }, 0);
}

function lineTotal(line: LineDraft): number {
    if (!isPositiveInteger(line.totalQuantity) || !isMoney(line.buyingPrice)) return 0;
    return Number(line.totalQuantity) * Number(line.buyingPrice);
}

export function StockManager(): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();
    const canManage = admin?.role === AdminRole.SYSTEM || admin?.role === AdminRole.MANAGER;
    const canDelete = admin?.role === AdminRole.SYSTEM;

    const [entries, setEntries] = useState<PublicStockEntry[]>([]);
    const [products, setProducts] = useState<PublicProduct[]>([]);
    const [suppliers, setSuppliers] = useState<PublicSupplier[]>([]);
    const [availability, setAvailability] = useState<PublicStockAvailability[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [productFilter, setProductFilter] = useState('');
    const [skuFilter, setSkuFilter] = useState('');
    const [supplierFilter, setSupplierFilter] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<StockFormState>(() => createEmptyForm());
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [supplierName, setSupplierName] = useState('');
    const [savingSupplier, setSavingSupplier] = useState(false);

    const loadStock = useCallback(async () => {
        setLoading(true);
        setListError(null);
        const filter: StockEntryFilter = {
            ...(month !== '' ? { month: Number(month) } : {}),
            ...(year !== '' ? { year: Number(year) } : {}),
            ...(productFilter !== '' ? { productId: productFilter } : {}),
            ...(supplierFilter !== '' ? { supplierId: supplierFilter } : {}),
        };
        try {
            const [entryList, productList, supplierList, availabilityList] = await Promise.all([
                adminApi.listStockEntries(filter),
                adminApi.listProducts(),
                adminApi.listSuppliers(),
                adminApi.listStockAvailability(),
            ]);
            setEntries(entryList);
            setProducts(productList);
            setSuppliers(supplierList);
            setAvailability(availabilityList);
        } catch (caught) {
            setListError(apiMessage(caught, t('loadStockError')));
        } finally {
            setLoading(false);
        }
    }, [t, month, year, productFilter, supplierFilter]);

    useEffect(() => {
        void loadStock();
    }, [loadStock]);

    const productById = useMemo(
        () => new Map(products.map((product) => [product.id, product])),
        [products],
    );
    const skuById = useMemo(() => {
        const map = new Map<string, PublicProductSku>();
        for (const product of products) {
            for (const sku of product.skus) map.set(sku.id, sku);
        }
        return map;
    }, [products]);
    const supplierById = useMemo(
        () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
        [suppliers],
    );
    const availabilityBySku = useMemo(
        () => new Map(availability.map((item) => [item.skuId, item])),
        [availability],
    );
    const sortedProducts = useMemo(
        () => [...products].sort((a, b) => a.name.localeCompare(b.name) || a.ref.localeCompare(b.ref)),
        [products],
    );
    const sortedAvailability = useMemo(
        () => [...availability].sort((a, b) => a.productName.localeCompare(b.productName) || a.sku.localeCompare(b.sku)),
        [availability],
    );
    const filteredAvailability = useMemo(
        () => skuFilter === ''
            ? sortedAvailability
            : sortedAvailability.filter((item) => item.skuId === skuFilter),
        [sortedAvailability, skuFilter],
    );

    const numberFormatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'long' });
    const integerFormatter = new Intl.NumberFormat(locale);
    const formatDate = (value: string) =>
        dateFormatter.format(new Date(value.length === 10 ? `${value}T00:00:00` : value));

    const months = useMemo(
        () => Array.from({ length: 12 }, (_, index) => ({
            value: String(index + 1),
            label: monthFormatter.format(new Date(2026, index, 1)),
        })),
        [monthFormatter],
    );
    const years = useMemo(() => buildYearOptions(), []);

    const formTotal = form.lines.reduce((sum, line) => sum + lineTotal(line), 0);

    const resetForm = () => {
        setFormOpen(false);
        setForm(createEmptyForm());
        setFormError(null);
    };

    const openCreateForm = () => {
        if (formOpen) {
            resetForm();
            return;
        }
        setNotice(null);
        setFormError(null);
        setForm(createEmptyForm(suppliers[0]?.id ?? ''));
        setFormOpen(true);
    };

    const selectProduct = (key: string, productId: string) => {
        setForm((current) => ({
            ...current,
            lines: current.lines.map((line) =>
                line.key === key ? makeLine(productById.get(productId)) : line,
            ),
        }));
    };

    const changeLine = (key: string, changes: Partial<LineDraft>) => {
        setForm((current) => ({
            ...current,
            lines: current.lines.map((line) => (line.key === key ? { ...line, ...changes } : line)),
        }));
    };

    const changeCombination = (lineKey: string, skuId: string, quantity: string) => {
        setForm((current) => ({
            ...current,
            lines: current.lines.map((line) =>
                line.key === lineKey
                    ? {
                        ...line,
                        combinations: line.combinations.map((combination) =>
                            combination.skuId === skuId ? { ...combination, quantity } : combination,
                        ),
                    }
                    : line,
            ),
        }));
    };

    const addLine = () => {
        setForm((current) => ({ ...current, lines: [...current.lines, makeLine()] }));
    };

    const removeLine = (key: string) => {
        setForm((current) => ({ ...current, lines: current.lines.filter((line) => line.key !== key) }));
    };

    const validateForm = (): string | null => {
        if (form.date.trim() === '') return t('stockDateRequired');
        if (form.supplierId === '') return t('stockSupplierRequired');
        if (form.lines.length === 0) return t('stockLinesRequired');

        const productIds = form.lines.map((line) => line.productId);
        if (new Set(productIds).size !== productIds.length) return t('stockDuplicateProduct');

        for (const line of form.lines) {
            const product = productById.get(line.productId);
            if (!product) return t('stockProductRequired');

            const expected = activeSkus(product);
            if (expected.length === 0) return t('stockCombinationsRequired');
            if (!isMoney(line.buyingPrice)) return t('stockBuyingPriceInvalid');
            if (!isPositiveInteger(line.totalQuantity)) return t('stockTotalQuantityInvalid');

            const skuIds = line.combinations.map((combination) => combination.skuId);
            const expectedIds = new Set(expected.map((sku) => sku.id));
            if (
                skuIds.length !== expectedIds.size ||
                new Set(skuIds).size !== skuIds.length ||
                skuIds.some((skuId) => !expectedIds.has(skuId))
            ) {
                return t('stockCombinationsRequired');
            }
            if (line.combinations.some((combination) => !isNonNegativeInteger(combination.quantity))) {
                return t('stockCombinationQuantityInvalid');
            }

            const sum = combinationSum(line);
            const total = Number(line.totalQuantity);
            if (sum !== total) {
                return `${t('stockCombinationSumInvalid')} (${sum}/${total}).`;
            }
        }
        return null;
    };

    const handleSave = async () => {
        setFormError(null);
        setNotice(null);

        const validationError = validateForm();
        if (validationError !== null) {
            setFormError(validationError);
            return;
        }

        setSaving(true);
        try {
            await adminApi.createStockEntry({
                date: form.date,
                supplierId: form.supplierId,
                items: form.lines.map((line) => ({
                    productId: line.productId,
                    buyingPrice: Number(line.buyingPrice),
                    totalQuantity: Number(line.totalQuantity),
                    combinations: line.combinations.map((combination) => ({
                        skuId: combination.skuId,
                        quantity: Number(combination.quantity),
                    })),
                })),
            });
            resetForm();
            setNotice(t('stockEntryCreated'));
            await loadStock();
        } catch (caught) {
            setFormError(apiMessage(caught, t('createStockEntryError')));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (entry: PublicStockEntry) => {
        setFormError(null);
        setNotice(null);
        setDeletingId(entry.id);
        try {
            await adminApi.removeStockEntry(entry.id);
            setConfirmId(null);
            setNotice(t('stockEntryDeleted'));
            await loadStock();
        } catch (caught) {
            setFormError(apiMessage(caught, t('deleteStockEntryError')));
        } finally {
            setDeletingId(null);
        }
    };

    const handleCreateSupplier = async () => {
        setFormError(null);
        setNotice(null);
        const name = supplierName.trim();
        if (name === '') {
            setFormError(t('supplierNameRequired'));
            return;
        }
        setSavingSupplier(true);
        try {
            const supplier = await adminApi.createSupplier({ name });
            setSuppliers((current) => [...current, supplier].sort((a, b) => a.name.localeCompare(b.name)));
            setSupplierName('');
            setNotice(t('supplierCreated'));
        } catch (caught) {
            setFormError(apiMessage(caught, t('supplierError')));
        } finally {
            setSavingSupplier(false);
        }
    };

    const handleDeleteSupplier = async (supplier: PublicSupplier) => {
        setFormError(null);
        setNotice(null);
        try {
            await adminApi.removeSupplier(supplier.id);
            setSuppliers((current) => current.filter((item) => item.id !== supplier.id));
            if (form.supplierId === supplier.id) {
                setForm((current) => ({ ...current, supplierId: '' }));
            }
        } catch (caught) {
            setFormError(apiMessage(caught, t('supplierError')));
        }
    };

    const resetFilters = () => {
        setMonth('');
        setYear('');
        setProductFilter('');
        setSupplierFilter('');
    };

    return (
        <>
            <header className="page-heading toolbar">
                <div>
                    <h2 className="page-title">{t('stockTitle')}</h2>
                    <p className="page-subtitle">{t('stockSubtitle')}</p>
                </div>
                <div className="toolbar-actions">
                    {canManage ? (
                        <button
                            type="button"
                            className="button primary small"
                            onClick={openCreateForm}
                            aria-expanded={formOpen}
                            aria-controls="stock-form"
                        >
                            {t('createStockEntry')}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void loadStock()}
                        disabled={loading}
                    >
                        {t('refresh')}
                    </button>
                </div>
            </header>

            {notice ? <p className="notice success" role="status">{notice}</p> : null}
            {formError ? <p className="notice error" role="alert">{formError}</p> : null}
            {!canManage ? (
                <div className="notice info" role="note">
                    <strong className="notice-title">{t('stockReadOnly')}</strong>
                </div>
            ) : null}

            <section className="section-card table-card" aria-label={t('stockEntriesLabel')}>
                <div className="table-toolbar stock-toolbar">
                    <label className="sr-only" htmlFor="stock-month-filter">{t('filterMonth')}</label>
                    <select
                        id="stock-month-filter"
                        className="field-input filter-select"
                        value={month}
                        onChange={(event) => setMonth(event.target.value)}
                        aria-label={t('filterMonth')}
                    >
                        <option value="">{t('allMonths')}</option>
                        {months.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                    </select>
                    <label className="sr-only" htmlFor="stock-year-filter">{t('filterYear')}</label>
                    <select
                        id="stock-year-filter"
                        className="field-input filter-select"
                        value={year}
                        onChange={(event) => setYear(event.target.value)}
                        aria-label={t('filterYear')}
                    >
                        <option value="">{t('allYears')}</option>
                        {years.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <label className="sr-only" htmlFor="stock-product-filter">{t('filterProduct')}</label>
                    <select
                        id="stock-product-filter"
                        className="field-input filter-select"
                        value={productFilter}
                        onChange={(event) => setProductFilter(event.target.value)}
                        aria-label={t('filterProduct')}
                    >
                        <option value="">{t('allProducts')}</option>
                        {products.map((product) => (
                            <option key={product.id} value={product.id}>
                                {product.ref} — {product.name}
                            </option>
                        ))}
                    </select>
                    <label className="sr-only" htmlFor="stock-supplier-filter">{t('filterSupplier')}</label>
                    <select
                        id="stock-supplier-filter"
                        className="field-input filter-select"
                        value={supplierFilter}
                        onChange={(event) => setSupplierFilter(event.target.value)}
                        aria-label={t('filterSupplier')}
                    >
                        <option value="">{t('allSuppliers')}</option>
                        {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                        ))}
                    </select>
                    <div className="table-toolbar-meta">
                        <span className="stat-note">{t('stockEntriesLabel')}: {entries.length}</span>
                        <button
                            type="button"
                            className="button secondary small"
                            onClick={resetFilters}
                            disabled={month === '' && year === '' && productFilter === '' && supplierFilter === ''}
                        >
                            {t('resetFilters')}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="center-state">
                        <span className="state-spinner" aria-hidden="true" />
                        <p className="state-text">{t('loadingStock')}</p>
                    </div>
                ) : listError ? (
                    <div className="empty-state">
                        <p className="state-text">{listError}</p>
                        <button type="button" className="button secondary small" onClick={() => void loadStock()}>
                            {t('retry')}
                        </button>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">
                            {month || year || productFilter || supplierFilter
                                ? t('stockNoResults')
                                : t('stockEmpty')}
                        </p>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="data-table stock-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t('columnEntryDate')}</th>
                                    <th scope="col">{t('columnSupplier')}</th>
                                    <th scope="col">{t('columnProducts')}</th>
                                    <th scope="col" className="column-center">{t('lineItems')}</th>
                                    <th scope="col" className="column-right">{t('columnTotal')}</th>
                                    <th scope="col">{t('columnAdmin')}</th>
                                    {canDelete ? <th scope="col" className="column-actions">{t('actions')}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry) => (
                                    <tr key={entry.id}>
                                        <td className="table-date">{formatDate(entry.date)}</td>
                                        <td>
                                            <span className="client-primary">
                                                {supplierById.get(entry.supplierId)?.name ?? entry.supplierName}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="stock-entry-products">
                                                {entry.items.map((item) => (
                                                    <div className="stock-entry-product" key={item.id}>
                                                        <div className="stock-entry-product-head">
                                                            <span className="category-tag">
                                                                {item.productRef || productById.get(item.productId)?.ref}
                                                            </span>
                                                            <span className="tag-quantity">
                                                                ×{integerFormatter.format(item.totalQuantity)}
                                                            </span>
                                                        </div>
                                                        <span className="client-secondary">
                                                            {productById.get(item.productId)?.name ?? item.productName}
                                                        </span>
                                                        <span className="stock-combination-summary">
                                                            {item.combinations.map((combination) =>
                                                                `${combination.skuLabel || combination.sku}: ${combination.quantity}`,
                                                            ).join(' · ')}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="muted text-center">
                                            <span className="count-badge">{entry.items.length}</span>
                                        </td>
                                        <td className="table-price text-right">
                                            {numberFormatter.format(entry.total)}
                                        </td>
                                        <td className="muted">{entry.adminUsername}</td>
                                        {canDelete ? (
                                            <td className="table-actions">
                                                {confirmId === entry.id ? (
                                                    <div className="inline-confirm">
                                                        <span className="confirm-text">{t('confirmDeleteEntry')}</span>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => void handleDelete(entry)}
                                                            disabled={deletingId === entry.id}
                                                        >
                                                            {deletingId === entry.id ? t('deleting') : t('delete')}
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
                                                            className="button danger small"
                                                            onClick={() => setConfirmId(entry.id)}
                                                            title={t('systemOnlyDelete')}
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

            <section className="section-card table-card" aria-labelledby="stock-availability-title">
                <h3 className="section-title" id="stock-availability-title">
                    {t('stockAvailabilityTitle')}
                </h3>
                <p className="section-description">{t('stockSkuNote')}</p>
                <div className="table-toolbar stock-toolbar">
                    <label className="sr-only" htmlFor="stock-availability-sku-filter">{t('filterSku')}</label>
                    <select
                        id="stock-availability-sku-filter"
                        className="field-input filter-select"
                        value={skuFilter}
                        onChange={(event) => setSkuFilter(event.target.value)}
                        aria-label={t('filterSku')}
                    >
                        <option value="">{t('allSkus')}</option>
                        {sortedAvailability.map((item) => (
                            <option key={item.skuId} value={item.skuId}>
                                {item.productName} — {item.label || item.sku}
                            </option>
                        ))}
                    </select>
                    <div className="table-toolbar-meta">
                        <span className="stat-note">{t('stockAvailabilityTitle')}: {filteredAvailability.length}</span>
                        <button
                            type="button"
                            className="button secondary small"
                            onClick={() => setSkuFilter('')}
                            disabled={skuFilter === ''}
                        >
                            {t('resetFilters')}
                        </button>
                    </div>
                </div>
                {sortedAvailability.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('stockAvailabilityEmpty')}</p>
                    </div>
                ) : filteredAvailability.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('stockNoResults')}</p>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t('filterProduct')}</th>
                                    <th scope="col">{t('columnSku')}</th>
                                    <th scope="col">{t('skuLabel')}</th>
                                    <th scope="col" className="column-right">{t('columnStock')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAvailability.map((item) => (
                                    <tr key={item.skuId}>
                                        <td>
                                            <strong className="table-ref">{item.productRef}</strong>
                                            <span className="client-secondary">{item.productName}</span>
                                        </td>
                                        <td className="table-ref">{item.sku}</td>
                                        <td>{item.label || '—'}</td>
                                        <td className="text-center">
                                            <span
                                                className={
                                                    item.stockQuantity > 0
                                                        ? 'stock-badge in-stock'
                                                        : 'stock-badge out-of-stock'
                                                }
                                            >
                                                {integerFormatter.format(item.stockQuantity)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {canManage && formOpen ? (
                <section id="stock-form" className="section-card stock-form" aria-labelledby="stock-form-title">
                    <h3 className="section-title" id="stock-form-title">{t('stockCreateTitle')}</h3>
                    <p className="section-description">{t('stockCreateDescription')}</p>
                    <p className="field-hint">{t('stockLineNote')}</p>

                    <div className="form-stack compact">
                        <div className="field-grid document-meta-grid">
                            <div className="field">
                                <label className="field-label" htmlFor="stock-date">{t('columnEntryDate')}</label>
                                <input
                                    id="stock-date"
                                    type="date"
                                    className="field-input"
                                    value={form.date}
                                    onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                                />
                            </div>
                            <div className="field">
                                <label className="field-label" htmlFor="stock-supplier">{t('columnSupplier')}</label>
                                <select
                                    id="stock-supplier"
                                    className="field-input"
                                    value={form.supplierId}
                                    onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value }))}
                                >
                                    <option value="">{t('supplierName')}</option>
                                    {suppliers.map((supplier) => (
                                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="line-items">
                            <div className="line-items-heading">
                                <h4 className="section-title small-title">{t('lineItems')}</h4>
                                <button type="button" className="button secondary small" onClick={addLine}>
                                    {t('addLine')}
                                </button>
                            </div>

                            {form.lines.map((line, index) => {
                                const product = productById.get(line.productId);
                                const sum = combinationSum(line);
                                const total = isPositiveInteger(line.totalQuantity) ? Number(line.totalQuantity) : 0;
                                const balanced = total > 0 && sum === total;

                                return (
                                    <article className="stock-product-line" key={line.key}>
                                        <div className="stock-line-header">
                                            <span className="line-index">{index + 1}</span>
                                            <select
                                                className="field-input product-select"
                                                aria-label={`${t('filterProduct')} ${index + 1}`}
                                                value={line.productId}
                                                onChange={(event) => selectProduct(line.key, event.target.value)}
                                            >
                                                <option value="">{t('allProducts')}</option>
                                                {sortedProducts.map((item) => (
                                                    <option key={item.id} value={item.id}>
                                                        {item.ref} — {item.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="field-input field-number"
                                                aria-label={`${t('columnBuyingPrice')} ${index + 1}`}
                                                placeholder={t('columnBuyingPrice')}
                                                value={line.buyingPrice}
                                                onChange={(event) => changeLine(line.key, { buyingPrice: event.target.value })}
                                            />
                                            <input
                                                type="number"
                                                min="1"
                                                step="1"
                                                className="field-input field-number"
                                                aria-label={`${t('columnTotalQuantity')} ${index + 1}`}
                                                placeholder={t('columnTotalQuantity')}
                                                value={line.totalQuantity}
                                                onChange={(event) => changeLine(line.key, { totalQuantity: event.target.value })}
                                            />
                                            <span className="line-total">
                                                {numberFormatter.format(lineTotal(line))}
                                            </span>
                                            <button
                                                type="button"
                                                className="button danger small line-item-actions"
                                                onClick={() => removeLine(line.key)}
                                                aria-label={`${t('removeLine')} ${index + 1}`}
                                            >
                                                {t('removeLine')}
                                            </button>
                                        </div>

                                        <div className="combination-grid">
                                            <span className="combination-grid-title">{t('stockDistribution')}</span>
                                            {line.combinations.length === 0 ? (
                                                <p className="field-hint">{t('stockCombinationsRequired')}</p>
                                            ) : (
                                                <>
                                                    <div className="combination-grid-head">
                                                        <span>{t('skuLabel')}</span>
                                                        <span>{t('columnSku')}</span>
                                                        <span>{t('columnStock')}</span>
                                                        <span>{t('columnQuantity')}</span>
                                                    </div>
                                                    {line.combinations.map((combination) => {
                                                        const sku = skuById.get(combination.skuId);
                                                        const stock = availabilityBySku.get(combination.skuId)?.stockQuantity
                                                            ?? sku?.stockQuantity
                                                            ?? 0;
                                                        return (
                                                            <div className="combination-grid-row" key={combination.skuId}>
                                                                <span>{sku?.label || '—'}</span>
                                                                <span className="table-ref">{sku?.sku || '—'}</span>
                                                                <span className="text-center">
                                                                    {integerFormatter.format(stock)}
                                                                </span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="1"
                                                                    className="field-input field-number"
                                                                    aria-label={`${t('columnQuantity')} ${sku?.label ?? combination.skuId}`}
                                                                    value={combination.quantity}
                                                                    onChange={(event) =>
                                                                        changeCombination(line.key, combination.skuId, event.target.value)
                                                                    }
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                            )}
                                            <div className={`combination-summary${balanced ? ' balanced' : ''}`}>
                                                {t('columnQuantity')}: {integerFormatter.format(sum)} /{' '}
                                                {integerFormatter.format(total)}
                                                {product ? ` · ${product.ref}` : ''}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}

                            <div className="total-row">
                                <span className="total-label">{t('grandTotal')}</span>
                                <strong className="grand-total">{numberFormatter.format(formTotal)}</strong>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="button primary"
                                onClick={() => void handleSave()}
                                disabled={saving}
                            >
                                {saving ? t('saving') : t('save')}
                            </button>
                            <button type="button" className="button secondary" onClick={resetForm}>
                                {t('cancel')}
                            </button>
                        </div>
                    </div>
                </section>
            ) : null}

            {canManage ? (
                <section className="section-card narrow supplier-card" aria-labelledby="supplier-title">
                    <h3 className="section-title" id="supplier-title">{t('supplierTitle')}</h3>
                    <p className="section-description">{t('supplierDescription')}</p>
                    <div className="supplier-form">
                        <label className="sr-only" htmlFor="supplier-name">{t('supplierName')}</label>
                        <input
                            id="supplier-name"
                            className="field-input"
                            value={supplierName}
                            placeholder={t('supplierName')}
                            onChange={(event) => setSupplierName(event.target.value)}
                        />
                        <button
                            type="button"
                            className="button primary small"
                            onClick={() => void handleCreateSupplier()}
                            disabled={savingSupplier}
                        >
                            {t('addSupplier')}
                        </button>
                    </div>
                    <p className="field-hint">{t('suppliersHint')}</p>
                    <div className="supplier-list">
                        {suppliers.map((supplier) => (
                            <span className="supplier-chip" key={supplier.id}>
                                {supplier.name}
                                <button
                                    type="button"
                                    className="chip-remove"
                                    onClick={() => void handleDeleteSupplier(supplier)}
                                    aria-label={`${t('delete')} ${supplier.name}`}
                                    title={t('delete')}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                </section>
            ) : null}
        </>
    );
}
