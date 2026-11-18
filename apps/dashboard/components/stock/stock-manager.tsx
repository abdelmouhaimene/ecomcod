'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AdminRole,
    type PublicProduct,
    type PublicStockEntry,
    type PublicSupplier,
    type StockEntryFilter,
} from '@repo/types';
import { AdminApiError, adminApi } from '../../lib/admin-api';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';

interface LineDraft {
    key: string;
    productId: string;
    quantity: string;
    unitPrice: string;
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

function createEmptyForm(supplierId = ''): StockFormState {
    return {
        date: new Date().toISOString().slice(0, 10),
        supplierId,
        lines: [{ key: nextTempKey(), productId: '', quantity: '1', unitPrice: '' }],
    };
}

function isPositiveInteger(value: string): boolean {
    return /^\d+$/.test(value.trim()) && Number(value) > 0;
}

function isMoney(value: string): boolean {
    const trimmed = value.trim();
    return /^\d+(\.\d{1,2})?$/.test(trimmed) && Number.isFinite(Number(trimmed));
}

export function StockManager(): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();
    const canManage = admin?.role === AdminRole.SYSTEM || admin?.role === AdminRole.MANAGER;
    const canDelete = admin?.role === AdminRole.SYSTEM;

    const [entries, setEntries] = useState<PublicStockEntry[]>([]);
    const [products, setProducts] = useState<PublicProduct[]>([]);
    const [suppliers, setSuppliers] = useState<PublicSupplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [productFilter, setProductFilter] = useState('');
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
            const [entryList, productList, supplierList] = await Promise.all([
                adminApi.listStockEntries(filter),
                adminApi.listProducts(),
                adminApi.listSuppliers(),
            ]);
            setEntries(entryList);
            setProducts(productList);
            setSuppliers(supplierList);
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
    const supplierById = useMemo(
        () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
        [suppliers],
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
    const years = useMemo(() => {
        const current = new Date().getFullYear();
        return Array.from({ length: 6 }, (_, index) => String(current - index));
    }, []);

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

    const changeLine = (key: string, changes: Partial<LineDraft>) => {
        setForm((current) => ({
            ...current,
            lines: current.lines.map((line) => (line.key === key ? { ...line, ...changes } : line)),
        }));
    };

    const addLine = () => {
        setForm((current) => ({
            ...current,
            lines: [...current.lines, { key: nextTempKey(), productId: '', quantity: '1', unitPrice: '' }],
        }));
    };

    const removeLine = (key: string) => {
        setForm((current) => ({ ...current, lines: current.lines.filter((line) => line.key !== key) }));
    };

    const formTotal = form.lines.reduce((sum, line) => {
        const quantity = isPositiveInteger(line.quantity) ? Number(line.quantity) : 0;
        const unitPrice = isMoney(line.unitPrice) ? Number(line.unitPrice) : 0;
        return sum + quantity * unitPrice;
    }, 0);

    const handleSave = async () => {
        setFormError(null);
        setNotice(null);

        if (form.date.trim() === '') {
            setFormError(t('stockDateRequired'));
            return;
        }
        if (form.supplierId === '') {
            setFormError(t('stockSupplierRequired'));
            return;
        }
        if (form.lines.length === 0) {
            setFormError(t('stockLinesRequired'));
            return;
        }
        if (form.lines.some((line) =>
            line.productId === '' || !isPositiveInteger(line.quantity) || !isMoney(line.unitPrice))) {
            setFormError(t('stockLineInvalid'));
            return;
        }

        setSaving(true);
        try {
            await adminApi.createStockEntry({
                date: form.date,
                supplierId: form.supplierId,
                items: form.lines.map((line) => ({
                    productId: line.productId,
                    quantity: Number(line.quantity),
                    unitPrice: Number(line.unitPrice),
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
                            disabled={
                                month === '' && year === '' && productFilter === '' && supplierFilter === ''
                            }
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
                                            <div className="category-tags">
                                                {entry.items.map((item) => (
                                                    <span className="category-tag" key={item.id}>
                                                        {item.productRef || productById.get(item.productId)?.ref}
                                                        <span className="tag-quantity">
                                                            ×{integerFormatter.format(item.quantity)}
                                                        </span>
                                                    </span>
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

            {canManage && formOpen ? (
                <section id="stock-form" className="section-card stock-form" aria-labelledby="stock-form-title">
                    <h3 className="section-title" id="stock-form-title">{t('stockCreateTitle')}</h3>
                    <p className="section-description">{t('stockCreateDescription')}</p>

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

                            {form.lines.map((line, index) => (
                                <div className="line-item-row" key={line.key}>
                                    <span className="line-index">{index + 1}</span>
                                    <select
                                        className="field-input"
                                        aria-label={`${t('filterProduct')} ${index + 1}`}
                                        value={line.productId}
                                        onChange={(event) => changeLine(line.key, { productId: event.target.value })}
                                    >
                                        <option value="">{t('filterProduct')}</option>
                                        {products.map((product) => (
                                            <option key={product.id} value={product.id}>
                                                {product.ref} — {product.name}
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
                                        onChange={(event) => changeLine(line.key, { quantity: event.target.value })}
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="field-input field-number"
                                        aria-label={`${t('columnUnitPrice')} ${index + 1}`}
                                        value={line.unitPrice}
                                        onChange={(event) => changeLine(line.key, { unitPrice: event.target.value })}
                                    />
                                    <span className="line-total">
                                        {numberFormatter.format(
                                            (isPositiveInteger(line.quantity) ? Number(line.quantity) : 0) *
                                            (isMoney(line.unitPrice) ? Number(line.unitPrice) : 0),
                                        )}
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
                            ))}

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
