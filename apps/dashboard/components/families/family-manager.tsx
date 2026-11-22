'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminRole, type FamilyPayload, type PublicFamily } from '@repo/types';
import { AdminApiError, adminApi } from '../../lib/admin-api';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';

interface FamilyFormState {
    name: string;
    ref: string;
    description: string;
}

const FAMILY_REF_PATTERN = /^[a-zA-Z0-9_-]+$/;

function apiMessage(caught: unknown, fallback: string): string {
    return caught instanceof AdminApiError ? caught.message : fallback;
}

function matchesSearch(family: PublicFamily, query: string): boolean {
    if (!query) return true;
    return [family.ref, family.name].some((value) => value.toLowerCase().includes(query));
}

const emptyForm: FamilyFormState = { name: '', ref: '', description: '' };

export function FamilyManager(): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();
    const canManage =
        admin?.role === AdminRole.SYSTEM || admin?.role === AdminRole.MANAGER;

    const [families, setFamilies] = useState<PublicFamily[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FamilyFormState>(emptyForm);
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadFamilies = useCallback(async () => {
        setLoading(true);
        setListError(null);
        try {
            setFamilies(await adminApi.listFamilies());
        } catch (caught) {
            setListError(apiMessage(caught, t('loadFamiliesError')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadFamilies();
    }, [loadFamilies]);

    const filteredFamilies = useMemo(() => {
        const query = search.trim().toLowerCase();
        return families.filter((family) => matchesSearch(family, query));
    }, [families, search]);

    const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const formatDate = (value: string) => dateFormatter.format(new Date(value));

    const resetForm = () => {
        setEditingId(null);
        setForm(emptyForm);
        setFormError(null);
    };

    const startEdit = (family: PublicFamily) => {
        setNotice(null);
        setFormError(null);
        setEditingId(family.id);
        setForm({
            name: family.name,
            ref: family.ref,
            description: family.description ?? '',
        });
    };

    const handleSave = async () => {
        setFormError(null);
        setNotice(null);

        const ref = form.ref.trim();
        const name = form.name.trim();
        const description = form.description.trim();
        if (!ref) {
            setFormError(t('refRequired'));
            return;
        }
        if (!name) {
            setFormError(t('nameRequired'));
            return;
        }
        if (!FAMILY_REF_PATTERN.test(ref)) {
            setFormError(t('refFormatInvalid'));
            return;
        }

        const payload: FamilyPayload = { ref, name, description: description || null };
        setSaving(true);
        try {
            if (editingId !== null) {
                await adminApi.updateFamily(editingId, payload);
                setNotice(t('familyUpdated'));
            } else {
                await adminApi.createFamily(payload);
                setNotice(t('familyCreated'));
            }
            resetForm();
            await loadFamilies();
        } catch (caught) {
            setFormError(
                apiMessage(caught, t(editingId === null ? 'createFamilyError' : 'updateFamilyError')),
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (family: PublicFamily) => {
        setFormError(null);
        setNotice(null);
        setDeletingId(family.id);
        try {
            await adminApi.removeFamily(family.id);
            setFamilies((current) => current.filter((item) => item.id !== family.id));
            if (editingId === family.id) resetForm();
            setConfirmId(null);
            setNotice(t('familyDeleted'));
        } catch (caught) {
            setFormError(apiMessage(caught, t('deleteFamilyError')));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <header className="page-heading toolbar">
                <div>
                    <h2 className="page-title">{t('familiesTitle')}</h2>
                    <p className="page-subtitle">{t('familiesSubtitle')}</p>
                </div>
                <div className="toolbar-actions">
                    <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void loadFamilies()}
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
                <section className="section-card narrow" aria-labelledby="family-form-title">
                    <h3 className="section-title" id="family-form-title">
                        {editingId === null ? t('createFamily') : t('editFamily')}
                    </h3>
                    <p className="section-description">{t('familiesSubtitle')}</p>

                    <div className="form-stack compact">
                        <div className="field">
                            <label className="field-label" htmlFor="family-ref">
                                {t('ref')}
                            </label>
                            <input
                                id="family-ref"
                                className="field-input"
                                value={form.ref}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, ref: event.target.value }))
                                }
                                autoComplete="off"
                            />
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="family-name">
                                {t('name')}
                            </label>
                            <input
                                id="family-name"
                                className="field-input"
                                value={form.name}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, name: event.target.value }))
                                }
                                autoComplete="off"
                            />
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="family-description">
                                {t('description')}
                            </label>
                            <textarea
                                id="family-description"
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

            <section className="section-card table-card" aria-labelledby="family-list-title">
                <h3 className="section-title" id="family-list-title">
                    {t('totalFamilies')}
                </h3>

                <div className="table-toolbar">
                    <input
                        type="search"
                        className="field-input search-input"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('searchFamilies')}
                        aria-label={t('searchFamilies')}
                    />
                    <span className="stat-note">
                        {t('showingFamilies')} {filteredFamilies.length} / {families.length}
                    </span>
                </div>

                {loading ? (
                    <div className="center-state">
                        <span className="state-spinner" aria-hidden="true" />
                        <p className="state-text">{t('loadingFamilies')}</p>
                    </div>
                ) : listError ? (
                    <div className="empty-state">
                        <p className="state-text">{listError}</p>
                        <button
                            type="button"
                            className="button secondary small"
                            onClick={() => void loadFamilies()}
                        >
                            {t('retry')}
                        </button>
                    </div>
                ) : families.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('familiesEmpty')}</p>
                    </div>
                ) : filteredFamilies.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('noFamilyResults')}</p>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t('columnRef')}</th>
                                    <th scope="col">{t('columnName')}</th>
                                    <th scope="col">{t('description')}</th>
                                    <th scope="col">{t('createdAt')}</th>
                                    {canManage ? <th scope="col">{t('actions')}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFamilies.map((family) => (
                                    <tr key={family.id}>
                                        <td>
                                            <strong className="table-ref">{family.ref}</strong>
                                        </td>
                                        <td>{family.name}</td>
                                        <td className="muted">
                                            {family.description ? (
                                                family.description
                                            ) : (
                                                <span aria-hidden="true">—</span>
                                            )}
                                        </td>
                                        <td className="muted">{formatDate(family.createdAt)}</td>
                                        {canManage ? (
                                            <td>
                                                {confirmId === family.id ? (
                                                    <div className="inline-confirm">
                                                        <span className="confirm-text">
                                                            {t('confirmDeleteFamily')}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => void handleDelete(family)}
                                                            disabled={deletingId === family.id}
                                                        >
                                                            {deletingId === family.id
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
                                                            onClick={() => startEdit(family)}
                                                        >
                                                            {t('edit')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => setConfirmId(family.id)}
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
