'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminRole } from '@repo/types';
import { AdminApiError } from '../../lib/admin-api';
import type { TranslationKey } from '../../lib/i18n';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';

/** Fields every admin-managed storefront text resource shares. */
export interface ManagedContentItem {
    id: string;
    position: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ContentFormValues {
    primary: string;
    secondary: string;
    position: number;
    isActive: boolean;
}

interface ContentRow {
    id: string;
    primary: string;
    secondary: string;
    position: number;
    isActive: boolean;
    createdAt: string;
}

export interface ContentLabels {
    title: TranslationKey;
    subtitle: TranslationKey;
    primary: TranslationKey;
    secondary: TranslationKey;
    create: TranslationKey;
    edit: TranslationKey;
    created: TranslationKey;
    updated: TranslationKey;
    deleted: TranslationKey;
    empty: TranslationKey;
    loadError: TranslationKey;
    createError: TranslationKey;
    updateError: TranslationKey;
    deleteError: TranslationKey;
    confirmDelete: TranslationKey;
    count: TranslationKey;
    search: TranslationKey;
    noResults: TranslationKey;
    primaryRequired: TranslationKey;
    secondaryRequired: TranslationKey;
}

export interface ContentManagerConfig<TItem extends ManagedContentItem, TPayload> {
    labels: ContentLabels;
    list: () => Promise<TItem[]>;
    create: (payload: TPayload) => Promise<TItem>;
    update: (id: string, payload: TPayload) => Promise<TItem>;
    remove: (id: string) => Promise<void>;
    toRow: (item: TItem) => ContentRow;
    buildPayload: (values: ContentFormValues) => TPayload;
}

interface ContentFormState {
    primary: string;
    secondary: string;
    position: string;
    isActive: boolean;
}

const emptyForm: ContentFormState = { primary: '', secondary: '', position: '0', isActive: true };

function apiMessage(caught: unknown, fallback: string): string {
    return caught instanceof AdminApiError ? caught.message : fallback;
}

function matchesSearch(row: ContentRow, query: string): boolean {
    if (!query) return true;
    return [row.primary, row.secondary].some((value) => value.toLowerCase().includes(query));
}

/** Shared create/edit/list screen for FAQ entries and policy articles. */
export function ContentManager<TItem extends ManagedContentItem, TPayload>({
    config,
}: {
    config: ContentManagerConfig<TItem, TPayload>;
}): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();
    const canManage =
        admin?.role === AdminRole.SYSTEM || admin?.role === AdminRole.MANAGER;

    const [items, setItems] = useState<TItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<ContentFormState>(emptyForm);
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadItems = useCallback(async () => {
        setLoading(true);
        setListError(null);
        try {
            setItems(await config.list());
        } catch (caught) {
            setListError(apiMessage(caught, t(config.labels.loadError)));
        } finally {
            setLoading(false);
        }
    }, [config, t]);

    useEffect(() => {
        void loadItems();
    }, [loadItems]);

    const rows = useMemo(
        () => items.map((item) => config.toRow(item)),
        [config, items],
    );
    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase();
        return rows.filter((row) => matchesSearch(row, query));
    }, [rows, search]);

    const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const formatDate = (value: string) => dateFormatter.format(new Date(value));

    const resetForm = () => {
        setEditingId(null);
        setForm(emptyForm);
        setFormError(null);
    };

    const startEdit = (row: ContentRow) => {
        const item = items.find((candidate) => candidate.id === row.id);
        if (!item) return;
        setNotice(null);
        setFormError(null);
        setEditingId(item.id);
        setForm({
            primary: row.primary,
            secondary: row.secondary,
            position: String(item.position),
            isActive: item.isActive,
        });
    };

    const handleSave = async () => {
        setFormError(null);
        setNotice(null);

        const primary = form.primary.trim();
        const secondary = form.secondary.trim();
        const positionText = form.position.trim();

        if (!primary) {
            setFormError(t(config.labels.primaryRequired));
            return;
        }
        if (!secondary) {
            setFormError(t(config.labels.secondaryRequired));
            return;
        }
        if (!/^\d+$/.test(positionText)) {
            setFormError(t('countInvalid'));
            return;
        }
        const position = Number(positionText);
        if (!Number.isSafeInteger(position)) {
            setFormError(t('countInvalid'));
            return;
        }

        const payload = config.buildPayload({
            primary,
            secondary,
            position,
            isActive: form.isActive,
        });
        setSaving(true);
        try {
            if (editingId !== null) {
                await config.update(editingId, payload);
                setNotice(t(config.labels.updated));
            } else {
                await config.create(payload);
                setNotice(t(config.labels.created));
            }
            resetForm();
            await loadItems();
        } catch (caught) {
            setFormError(
                apiMessage(
                    caught,
                    t(editingId === null ? config.labels.createError : config.labels.updateError),
                ),
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (row: ContentRow) => {
        setFormError(null);
        setNotice(null);
        setDeletingId(row.id);
        try {
            await config.remove(row.id);
            setItems((current) => current.filter((item) => item.id !== row.id));
            if (editingId === row.id) resetForm();
            setConfirmId(null);
            setNotice(t(config.labels.deleted));
        } catch (caught) {
            setFormError(apiMessage(caught, t(config.labels.deleteError)));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <header className="page-heading toolbar">
                <div>
                    <h2 className="page-title">{t(config.labels.title)}</h2>
                    <p className="page-subtitle">{t(config.labels.subtitle)}</p>
                </div>
                <div className="toolbar-actions">
                    <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void loadItems()}
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
                <section className="section-card narrow" aria-labelledby="content-form-title">
                    <h3 className="section-title" id="content-form-title">
                        {editingId === null
                            ? t(config.labels.create)
                            : t(config.labels.edit)}
                    </h3>
                    <p className="section-description">{t('contentSharedTextNotice')}</p>

                    <div className="form-stack compact">
                        <div className="field">
                            <label className="field-label" htmlFor="content-primary">
                                {t(config.labels.primary)}
                            </label>
                            <input
                                id="content-primary"
                                className="field-input"
                                value={form.primary}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        primary: event.target.value,
                                    }))
                                }
                                autoComplete="off"
                            />
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="content-secondary">
                                {t(config.labels.secondary)}
                            </label>
                            <textarea
                                id="content-secondary"
                                className="field-input"
                                rows={6}
                                value={form.secondary}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        secondary: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="content-position">
                                {t('position')}
                            </label>
                            <p className="field-hint">{t('contentPositionHint')}</p>
                            <input
                                id="content-position"
                                className="field-input"
                                type="number"
                                min={0}
                                value={form.position}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        position: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <label className="checkbox-field" htmlFor="content-active">
                            <input
                                id="content-active"
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

            <section className="section-card table-card" aria-labelledby="content-list-title">
                <h3 className="section-title" id="content-list-title">
                    {t(config.labels.count)} {filteredRows.length} / {rows.length}
                </h3>

                <div className="table-toolbar">
                    <input
                        type="search"
                        className="field-input search-input"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t(config.labels.search)}
                        aria-label={t(config.labels.search)}
                    />
                </div>

                {loading ? (
                    <div className="center-state">
                        <span className="state-spinner" aria-hidden="true" />
                        <p className="state-text">{t('contentLoading')}</p>
                    </div>
                ) : listError ? (
                    <div className="empty-state">
                        <p className="state-text">{listError}</p>
                        <button
                            type="button"
                            className="button secondary small"
                            onClick={() => void loadItems()}
                        >
                            {t('retry')}
                        </button>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t(config.labels.empty)}</p>
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t(config.labels.noResults)}</p>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t(config.labels.primary)}</th>
                                    <th scope="col">{t(config.labels.secondary)}</th>
                                    <th scope="col">{t('position')}</th>
                                    <th scope="col">{t('status')}</th>
                                    <th scope="col">{t('createdAt')}</th>
                                    {canManage ? <th scope="col">{t('actions')}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((row) => (
                                    <tr key={row.id}>
                                        <td>
                                            <strong>{row.primary}</strong>
                                        </td>
                                        <td>
                                            <div className="comment-content-cell">{row.secondary}</div>
                                        </td>
                                        <td className="muted">{row.position}</td>
                                        <td>
                                            <span
                                                className={
                                                    row.isActive ? 'badge active' : 'badge inactive'
                                                }
                                            >
                                                {t(row.isActive ? 'active' : 'inactive')}
                                            </span>
                                        </td>
                                        <td className="muted">{formatDate(row.createdAt)}</td>
                                        {canManage ? (
                                            <td>
                                                {confirmId === row.id ? (
                                                    <div className="inline-confirm">
                                                        <span className="confirm-text">
                                                            {t(config.labels.confirmDelete)}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => void handleDelete(row)}
                                                            disabled={deletingId === row.id}
                                                        >
                                                            {deletingId === row.id
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
                                                            onClick={() => startEdit(row)}
                                                        >
                                                            {t('edit')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => setConfirmId(row.id)}
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
