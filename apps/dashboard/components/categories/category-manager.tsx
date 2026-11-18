'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminRole, type CategoryPayload, type PublicCategory } from '@repo/types';
import { AdminApiError, adminApi } from '../../lib/admin-api';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';

interface CategoryFormState {
    name: string;
    ref: string;
}

function apiMessage(caught: unknown, fallback: string): string {
    return caught instanceof AdminApiError ? caught.message : fallback;
}

function matchesSearch(category: PublicCategory, query: string): boolean {
    if (!query) return true;
    return [category.ref, category.name].some((value) => value.toLowerCase().includes(query));
}

const emptyForm: CategoryFormState = { name: '', ref: '' };

export function CategoryManager(): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();
    const canManage =
        admin?.role === AdminRole.SYSTEM || admin?.role === AdminRole.MANAGER;

    const [categories, setCategories] = useState<PublicCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<CategoryFormState>(emptyForm);
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadCategories = useCallback(async () => {
        setLoading(true);
        setListError(null);
        try {
            setCategories(await adminApi.listCategories());
        } catch (caught) {
            setListError(apiMessage(caught, t('loadCategoriesError')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadCategories();
    }, [loadCategories]);

    const filteredCategories = useMemo(() => {
        const query = search.trim().toLowerCase();
        return categories.filter((category) => matchesSearch(category, query));
    }, [categories, search]);

    const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const formatDate = (value: string) => dateFormatter.format(new Date(value));

    const resetForm = () => {
        setEditingId(null);
        setForm(emptyForm);
        setFormError(null);
    };

    const startEdit = (category: PublicCategory) => {
        setNotice(null);
        setFormError(null);
        setEditingId(category.id);
        setForm({ name: category.name, ref: category.ref });
    };

    const handleSave = async () => {
        setFormError(null);
        setNotice(null);

        const ref = form.ref.trim();
        const name = form.name.trim();
        if (!ref) {
            setFormError(t('refRequired'));
            return;
        }
        if (!name) {
            setFormError(t('nameRequired'));
            return;
        }

        const payload: CategoryPayload = { ref, name };
        setSaving(true);
        try {
            if (editingId !== null) {
                await adminApi.updateCategory(editingId, payload);
                setNotice(t('categoryUpdated'));
            } else {
                await adminApi.createCategory(payload);
                setNotice(t('categoryCreated'));
            }
            resetForm();
            await loadCategories();
        } catch (caught) {
            setFormError(
                apiMessage(caught, t(editingId === null ? 'createCategoryError' : 'updateCategoryError')),
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (category: PublicCategory) => {
        setFormError(null);
        setNotice(null);
        setDeletingId(category.id);
        try {
            await adminApi.removeCategory(category.id);
            setCategories((current) => current.filter((item) => item.id !== category.id));
            if (editingId === category.id) resetForm();
            setConfirmId(null);
            setNotice(t('categoryDeleted'));
        } catch (caught) {
            setFormError(apiMessage(caught, t('deleteCategoryError')));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <header className="page-heading toolbar">
                <div>
                    <h2 className="page-title">{t('categoriesTitle')}</h2>
                    <p className="page-subtitle">{t('categoriesSubtitle')}</p>
                </div>
                <div className="toolbar-actions">
                    <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void loadCategories()}
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
                <section className="section-card narrow" aria-labelledby="category-form-title">
                    <h3 className="section-title" id="category-form-title">
                        {editingId === null ? t('createCategory') : t('editCategory')}
                    </h3>
                    <p className="section-description">{t('categoriesSubtitle')}</p>

                    <div className="form-stack compact">
                        <div className="field">
                            <label className="field-label" htmlFor="category-ref">
                                {t('ref')}
                            </label>
                            <input
                                id="category-ref"
                                className="field-input"
                                value={form.ref}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, ref: event.target.value }))
                                }
                                autoComplete="off"
                            />
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="category-name">
                                {t('name')}
                            </label>
                            <input
                                id="category-name"
                                className="field-input"
                                value={form.name}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, name: event.target.value }))
                                }
                                autoComplete="off"
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

            <section className="section-card table-card" aria-labelledby="category-list-title">
                <h3 className="section-title" id="category-list-title">
                    {t('totalCategories')}
                </h3>

                <div className="table-toolbar">
                    <input
                        type="search"
                        className="field-input search-input"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('searchCategories')}
                        aria-label={t('searchCategories')}
                    />
                    <span className="stat-note">
                        {t('showingCategories')} {filteredCategories.length} / {categories.length}
                    </span>
                </div>

                {loading ? (
                    <div className="center-state">
                        <span className="state-spinner" aria-hidden="true" />
                        <p className="state-text">{t('loadingCategories')}</p>
                    </div>
                ) : listError ? (
                    <div className="empty-state">
                        <p className="state-text">{listError}</p>
                        <button
                            type="button"
                            className="button secondary small"
                            onClick={() => void loadCategories()}
                        >
                            {t('retry')}
                        </button>
                    </div>
                ) : categories.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('categoriesEmpty')}</p>
                    </div>
                ) : filteredCategories.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('noCategoryResults')}</p>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t('columnRef')}</th>
                                    <th scope="col">{t('columnName')}</th>
                                    <th scope="col">{t('createdAt')}</th>
                                    {canManage ? <th scope="col">{t('actions')}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCategories.map((category) => (
                                    <tr key={category.id}>
                                        <td>
                                            <strong>{category.ref}</strong>
                                        </td>
                                        <td>{category.name}</td>
                                        <td className="muted">{formatDate(category.createdAt)}</td>
                                        {canManage ? (
                                            <td>
                                                {confirmId === category.id ? (
                                                    <div className="inline-confirm">
                                                        <span className="confirm-text">
                                                            {t('confirmDeleteCategory')}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => void handleDelete(category)}
                                                            disabled={deletingId === category.id}
                                                        >
                                                            {deletingId === category.id
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
                                                            onClick={() => startEdit(category)}
                                                        >
                                                            {t('edit')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => setConfirmId(category.id)}
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
