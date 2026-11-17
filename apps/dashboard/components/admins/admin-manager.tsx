'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminRole, type PublicAdmin } from '@repo/types';
import { AdminApiError, adminApi } from '../../lib/admin-api';
import type { TranslationKey } from '../../lib/i18n';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';

const CREATABLE_ROLES = [AdminRole.MANAGER, AdminRole.AGENT] as const;

const ROLE_LABELS: Record<AdminRole, TranslationKey> = {
    [AdminRole.SYSTEM]: 'roleSystem',
    [AdminRole.MANAGER]: 'roleManager',
    [AdminRole.AGENT]: 'roleAgent',
};

function apiMessage(caught: unknown, fallback: string): string {
    return caught instanceof AdminApiError ? caught.message : fallback;
}

export function AdminManager(): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();
    const isSystemAdmin = admin?.role === AdminRole.SYSTEM;

    const [admins, setAdmins] = useState<PublicAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<AdminRole>(AdminRole.MANAGER);
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmId, setConfirmId] = useState<string | null>(null);

    const loadAdmins = useCallback(async () => {
        setLoading(true);
        setListError(null);
        try {
            setAdmins(await adminApi.list());
        } catch (caught) {
            setListError(apiMessage(caught, t('loadError')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (isSystemAdmin) void loadAdmins();
    }, [isSystemAdmin, loadAdmins]);

    const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const formatDate = (value: string | null) =>
        value === null ? t('never') : dateFormatter.format(new Date(value));

    const handleCreate = async () => {
        setFormError(null);
        setNotice(null);

        const trimmedUsername = username.trim();
        if (trimmedUsername.length < 3) {
            setFormError(t('usernameRequired'));
            return;
        }
        if (password.length < 8) {
            setFormError(t('passwordTooShort'));
            return;
        }

        setCreating(true);
        try {
            await adminApi.create({ username: trimmedUsername, password, role });
            setUsername('');
            setPassword('');
            setRole(AdminRole.MANAGER);
            setNotice(t('createdSuccess'));
            await loadAdmins();
        } catch (caught) {
            setFormError(apiMessage(caught, t('createError')));
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        setFormError(null);
        setNotice(null);
        setDeletingId(id);
        try {
            await adminApi.remove(id);
            setAdmins((current) => current.filter((item) => item.id !== id));
            setConfirmId(null);
            setNotice(t('deleteSuccess'));
        } catch (caught) {
            setFormError(apiMessage(caught, t('deleteError')));
        } finally {
            setDeletingId(null);
        }
    };

    if (!isSystemAdmin) {
        return (
            <>
                <header className="page-heading">
                    <h2 className="page-title">{t('adminsTitle')}</h2>
                    <p className="page-subtitle">{t('adminsSubtitle')}</p>
                </header>
                <section className="section-card">
                    <h3 className="section-title">{t('systemOnlyTitle')}</h3>
                    <p className="section-description">{t('systemOnlyDescription')}</p>
                </section>
            </>
        );
    }

    return (
        <>
            <header className="page-heading toolbar">
                <div>
                    <h2 className="page-title">{t('adminsTitle')}</h2>
                    <p className="page-subtitle">{t('adminsSubtitle')}</p>
                </div>
                <div className="toolbar-actions">
                    <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void loadAdmins()}
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

            <div className="admin-layout">
                <section className="section-card" aria-labelledby="create-admin-title">
                    <h3 className="section-title" id="create-admin-title">
                        {t('createAdmin')}
                    </h3>
                    <p className="section-description">{t('createAdminDescription')}</p>

                    <div className="form-stack compact">
                        <div className="field">
                            <label className="field-label" htmlFor="new-admin-username">
                                {t('username')}
                            </label>
                            <input
                                id="new-admin-username"
                                className="field-input"
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                placeholder={t('usernamePlaceholder')}
                                autoComplete="off"
                            />
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="new-admin-password">
                                {t('password')}
                            </label>
                            <input
                                id="new-admin-password"
                                className="field-input"
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                autoComplete="new-password"
                            />
                            <p className="field-hint">{t('passwordHint')}</p>
                        </div>
                        <div className="field">
                            <label className="field-label" htmlFor="new-admin-role">
                                {t('role')}
                            </label>
                            <select
                                id="new-admin-role"
                                className="field-input"
                                value={role}
                                onChange={(event) => setRole(event.target.value as AdminRole)}
                            >
                                {CREATABLE_ROLES.map((option) => (
                                    <option key={option} value={option}>
                                        {t(ROLE_LABELS[option])}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            className="button primary block"
                            onClick={() => void handleCreate()}
                            disabled={creating}
                        >
                            {creating ? t('creating') : t('createAdmin')}
                        </button>
                    </div>
                </section>

                <section className="section-card table-card" aria-labelledby="admin-list-title">
                    <h3 className="section-title" id="admin-list-title">
                        {t('totalAdmins')}
                    </h3>

                    {loading ? (
                        <div className="center-state">
                            <span className="state-spinner" aria-hidden="true" />
                            <p className="state-text">{t('loadingAdmins')}</p>
                        </div>
                    ) : listError ? (
                        <div className="empty-state">
                            <p className="state-text">{listError}</p>
                            <button
                                type="button"
                                className="button secondary small"
                                onClick={() => void loadAdmins()}
                            >
                                {t('retry')}
                            </button>
                        </div>
                    ) : admins.length === 0 ? (
                        <div className="empty-state">
                            <p className="state-text">{t('adminsEmpty')}</p>
                        </div>
                    ) : (
                        <div className="table-scroll">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th scope="col">{t('adminColumn')}</th>
                                        <th scope="col">{t('role')}</th>
                                        <th scope="col">{t('status')}</th>
                                        <th scope="col">{t('lastLogin')}</th>
                                        <th scope="col">{t('createdAt')}</th>
                                        <th scope="col">{t('actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {admins.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <strong>{item.username}</strong>
                                            </td>
                                            <td>
                                                <span className="role-badge">
                                                    {t(ROLE_LABELS[item.role])}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={item.isActive ? 'badge active' : 'badge inactive'}>
                                                    {item.isActive ? t('active') : t('inactive')}
                                                </span>
                                            </td>
                                            <td className="muted">{formatDate(item.lastLoginAt)}</td>
                                            <td className="muted">{formatDate(item.createdAt)}</td>
                                            <td>
                                                {item.role === AdminRole.SYSTEM ? (
                                                    <span className="muted">—</span>
                                                ) : confirmId === item.id ? (
                                                    <div className="inline-confirm">
                                                        <span className="confirm-text">{t('confirmDelete')}</span>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => void handleDelete(item.id)}
                                                            disabled={deletingId === item.id}
                                                            aria-label={`${t('delete')} ${item.username}`}
                                                        >
                                                            {deletingId === item.id ? t('deleting') : t('delete')}
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
                                                    <button
                                                        type="button"
                                                        className="button danger small"
                                                        onClick={() => setConfirmId(item.id)}
                                                        aria-label={`${t('delete')} ${item.username}`}
                                                    >
                                                        {t('delete')}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </>
    );
}
