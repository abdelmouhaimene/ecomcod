'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminRole, type PublicSupplier, type SupplierPayload } from '@repo/types';
import { AdminApiError, adminApi } from '../../lib/admin-api';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';

interface SupplierFormState {
    name: string;
    address: string;
    phone: string;
    email: string;
    description: string;
}

const emptyForm: SupplierFormState = {
    name: '',
    address: '',
    phone: '',
    email: '',
    description: '',
};

function apiMessage(caught: unknown, fallback: string): string {
    return caught instanceof AdminApiError ? caught.message : fallback;
}

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function matchesSearch(supplier: PublicSupplier, query: string): boolean {
    if (!query) return true;
    return [
        supplier.name,
        supplier.email ?? '',
        supplier.phone ?? '',
        supplier.address ?? '',
    ].some((value) => value.toLowerCase().includes(query));
}

function truncate(value: string, maxLength = 60): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export function SupplierManager(): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();
    const canManage =
        admin?.role === AdminRole.SYSTEM || admin?.role === AdminRole.MANAGER;

    const [suppliers, setSuppliers] = useState<PublicSupplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<SupplierFormState>(emptyForm);
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadSuppliers = useCallback(async () => {
        setLoading(true);
        setListError(null);
        try {
            setSuppliers(await adminApi.listSuppliers());
        } catch (caught) {
            setListError(apiMessage(caught, t('supplierError')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadSuppliers();
    }, [loadSuppliers]);

    const filteredSuppliers = useMemo(() => {
        const query = search.trim().toLowerCase();
        return suppliers.filter((supplier) => matchesSearch(supplier, query));
    }, [suppliers, search]);

    const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const formatDate = (value: string) => dateFormatter.format(new Date(value));

    const resetForm = () => {
        setEditingId(null);
        setForm(emptyForm);
        setFormError(null);
    };

    const startEdit = (supplier: PublicSupplier) => {
        setNotice(null);
        setFormError(null);
        setEditingId(supplier.id);
        setForm({
            name: supplier.name,
            address: supplier.address ?? '',
            phone: supplier.phone ?? '',
            email: supplier.email ?? '',
            description: supplier.description ?? '',
        });
    };

    const handleSave = async () => {
        setFormError(null);
        setNotice(null);

        const name = form.name.trim();
        const email = form.email.trim();
        if (!name) {
            setFormError(t('supplierNameRequired'));
            return;
        }
        if (email !== '' && !isValidEmail(email)) {
            setFormError(t('supplierEmailInvalid'));
            return;
        }

        const payload: SupplierPayload = {
            name,
            address: form.address.trim() || null,
            phone: form.phone.trim() || null,
            email: email || null,
            description: form.description.trim() || null,
        };
        setSaving(true);
        try {
            if (editingId !== null) {
                await adminApi.updateSupplier(editingId, payload);
                setNotice(t('supplierUpdated'));
            } else {
                await adminApi.createSupplier(payload);
                setNotice(t('supplierCreated'));
            }
            resetForm();
            await loadSuppliers();
        } catch (caught) {
            setFormError(apiMessage(caught, t('supplierError')));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (supplier: PublicSupplier) => {
        setFormError(null);
        setNotice(null);
        setDeletingId(supplier.id);
        try {
            await adminApi.removeSupplier(supplier.id);
            setSuppliers((current) => current.filter((item) => item.id !== supplier.id));
            if (editingId === supplier.id) resetForm();
            setConfirmId(null);
            setNotice(t('supplierDeleted'));
        } catch (caught) {
            setFormError(apiMessage(caught, t('deleteSupplierError')));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <header className="page-heading toolbar">
                <div>
                    <h2 className="page-title">{t('supplierTitle')}</h2>
                    <p className="page-subtitle">{t('supplierDescription')}</p>
                </div>
                <div className="toolbar-actions">
                    <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void loadSuppliers()}
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
                <section className="section-card narrow" aria-labelledby="supplier-form-title">
                    <h3 className="section-title" id="supplier-form-title">
                        {editingId === null ? t('createSupplier') : t('editSupplier')}
                    </h3>
                    <p className="section-description">{t('supplierDescription')}</p>

                    <div className="form-stack compact">
                        <div className="field">
                            <label className="field-label" htmlFor="supplier-name">
                                {t('supplierName')}
                            </label>
                            <input
                                id="supplier-name"
                                className="field-input"
                                value={form.name}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, name: event.target.value }))
                                }
                                autoComplete="off"
                            />
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="supplier-address">
                                {t('supplierAddress')}
                            </label>
                            <input
                                id="supplier-address"
                                className="field-input"
                                value={form.address}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, address: event.target.value }))
                                }
                                autoComplete="off"
                            />
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="supplier-phone">
                                {t('supplierPhone')}
                            </label>
                            <input
                                id="supplier-phone"
                                className="field-input"
                                type="tel"
                                value={form.phone}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, phone: event.target.value }))
                                }
                                autoComplete="off"
                            />
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="supplier-email">
                                {t('supplierEmail')}
                            </label>
                            <input
                                id="supplier-email"
                                className="field-input"
                                type="email"
                                value={form.email}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, email: event.target.value }))
                                }
                                autoComplete="off"
                            />
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="supplier-description">
                                {t('supplierDesc')}
                            </label>
                            <textarea
                                id="supplier-description"
                                className="field-input"
                                value={form.description}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        description: event.target.value,
                                    }))
                                }
                                rows={3}
                            />
                        </div>
                        <div className="form-actions">
                            {editingId !== null ? (
                                <button
                                    type="button"
                                    className="button secondary"
                                    onClick={resetForm}
                                >
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

            <section className="section-card table-card" aria-labelledby="supplier-list-title">
                <h3 className="section-title" id="supplier-list-title">
                    {t('totalSuppliers')}
                </h3>

                <div className="table-toolbar">
                    <input
                        type="search"
                        className="field-input search-input"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('searchSuppliers')}
                        aria-label={t('searchSuppliers')}
                    />
                    <span className="stat-note">
                        {t('showingSuppliers')} {filteredSuppliers.length} / {suppliers.length}
                    </span>
                </div>

                {loading ? (
                    <div className="center-state">
                        <span className="state-spinner" aria-hidden="true" />
                        <p className="state-text">{t('loadingSuppliers')}</p>
                    </div>
                ) : listError ? (
                    <div className="empty-state">
                        <p className="state-text">{listError}</p>
                        <button
                            type="button"
                            className="button secondary small"
                            onClick={() => void loadSuppliers()}
                        >
                            {t('retry')}
                        </button>
                    </div>
                ) : suppliers.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('suppliersEmpty')}</p>
                    </div>
                ) : filteredSuppliers.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('noSupplierResults')}</p>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t('supplierName')}</th>
                                    <th scope="col">{t('columnContact')}</th>
                                    <th scope="col">{t('supplierAddress')}</th>
                                    <th scope="col">{t('createdAt')}</th>
                                    {canManage ? <th scope="col">{t('actions')}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSuppliers.map((supplier) => (
                                    <tr key={supplier.id}>
                                        <td>
                                            <strong>{supplier.name}</strong>
                                        </td>
                                        <td>
                                            {supplier.email || supplier.phone ? (
                                                <>
                                                    {supplier.email ? (
                                                        <span className="client-primary">
                                                            {supplier.email}
                                                        </span>
                                                    ) : null}
                                                    {supplier.phone ? (
                                                        <span className="client-secondary">
                                                            {supplier.phone}
                                                        </span>
                                                    ) : null}
                                                </>
                                            ) : (
                                                <span className="muted">—</span>
                                            )}
                                        </td>
                                        <td className="muted" title={supplier.address ?? ''}>
                                            {supplier.address ? truncate(supplier.address) : '—'}
                                        </td>
                                        <td className="muted table-date">
                                            {formatDate(supplier.createdAt)}
                                        </td>
                                        {canManage ? (
                                            <td>
                                                {confirmId === supplier.id ? (
                                                    <div className="inline-confirm">
                                                        <span className="confirm-text">
                                                            {t('confirmDeleteSupplier')}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => void handleDelete(supplier)}
                                                            disabled={deletingId === supplier.id}
                                                        >
                                                            {deletingId === supplier.id
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
                                                            onClick={() => startEdit(supplier)}
                                                        >
                                                            {t('edit')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => setConfirmId(supplier.id)}
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
