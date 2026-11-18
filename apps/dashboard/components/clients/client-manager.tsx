'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PublicUser } from '@repo/types';
import { AdminApiError, adminApi } from '../../lib/admin-api';
import { useDashboard } from '../providers/dashboard-provider';

type StatusFilter = 'all' | 'active' | 'inactive';
type VerificationFilter = 'all' | 'verified' | 'unverified';

function apiMessage(caught: unknown, fallback: string): string {
    return caught instanceof AdminApiError ? caught.message : fallback;
}

function matchesSearch(client: PublicUser, query: string): boolean {
    if (!query) return true;
    return [client.email, client.fullName, client.phoneNumber]
        .filter((value): value is string => typeof value === 'string')
        .some((value) => value.toLowerCase().includes(query));
}

export function ClientManager(): React.JSX.Element {
    const { locale, t } = useDashboard();
    const [clients, setClients] = useState<PublicUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<StatusFilter>('all');
    const [verification, setVerification] = useState<VerificationFilter>('all');

    const loadClients = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            setClients(await adminApi.listUsers());
        } catch (caught) {
            setLoadError(apiMessage(caught, t('loadClientsError')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadClients();
    }, [loadClients]);

    const filteredClients = useMemo(() => {
        const query = search.trim().toLowerCase();
        return clients.filter((client) => {
            const matchesStatus =
                status === 'all' || (status === 'active' ? client.isActive : !client.isActive);
            const isVerified = client.emailVerifiedAt !== null;
            const matchesVerification =
                verification === 'all' ||
                (verification === 'verified' ? isVerified : !isVerified);
            return matchesSearch(client, query) && matchesStatus && matchesVerification;
        });
    }, [clients, search, status, verification]);

    const verifiedCount = clients.filter((client) => client.emailVerifiedAt !== null).length;
    const activeCount = clients.filter((client) => client.isActive).length;
    const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const formatDate = (value: string | null) =>
        value === null ? t('never') : dateFormatter.format(new Date(value));

    return (
        <>
            <header className="page-heading toolbar">
                <div>
                    <h2 className="page-title">{t('clientsTitle')}</h2>
                    <p className="page-subtitle">{t('clientsSubtitle')}</p>
                </div>
                <div className="toolbar-actions">
                    <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void loadClients()}
                        disabled={loading}
                    >
                        {t('refresh')}
                    </button>
                </div>
            </header>

            <div className="stat-grid">
                <article className="stat-card">
                    <span className="stat-label">{t('totalClients')}</span>
                    <strong className="stat-value">{clients.length}</strong>
                </article>
                <article className="stat-card">
                    <span className="stat-label">{t('verifiedClients')}</span>
                    <strong className="stat-value">{verifiedCount}</strong>
                </article>
                <article className="stat-card">
                    <span className="stat-label">{t('activeClients')}</span>
                    <strong className="stat-value">{activeCount}</strong>
                </article>
                <article className="stat-card">
                    <span className="stat-label">{t('showingClients')}</span>
                    <strong className="stat-value">{filteredClients.length}</strong>
                    <span className="stat-note">/ {clients.length}</span>
                </article>
            </div>

            <section className="section-card table-card" aria-labelledby="client-list-title">
                <h3 className="section-title" id="client-list-title">
                    {t('clientColumn')}
                </h3>

                <div className="table-toolbar">
                    <input
                        type="search"
                        className="field-input search-input"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('searchClients')}
                        aria-label={t('searchClients')}
                    />
                    <label className="sr-only" htmlFor="client-status-filter">
                        {t('status')}
                    </label>
                    <select
                        id="client-status-filter"
                        className="field-input filter-select"
                        value={status}
                        onChange={(event) => setStatus(event.target.value as StatusFilter)}
                        aria-label={t('status')}
                    >
                        <option value="all">{t('allStatuses')}</option>
                        <option value="active">{t('active')}</option>
                        <option value="inactive">{t('inactive')}</option>
                    </select>
                    <label className="sr-only" htmlFor="client-verification-filter">
                        {t('verification')}
                    </label>
                    <select
                        id="client-verification-filter"
                        className="field-input filter-select"
                        value={verification}
                        onChange={(event) =>
                            setVerification(event.target.value as VerificationFilter)
                        }
                        aria-label={t('verification')}
                    >
                        <option value="all">{t('allVerification')}</option>
                        <option value="verified">{t('verified')}</option>
                        <option value="unverified">{t('unverified')}</option>
                    </select>
                </div>

                {loading ? (
                    <div className="center-state">
                        <span className="state-spinner" aria-hidden="true" />
                        <p className="state-text">{t('loadingClients')}</p>
                    </div>
                ) : loadError ? (
                    <div className="empty-state">
                        <p className="state-text">{loadError}</p>
                        <button
                            type="button"
                            className="button secondary small"
                            onClick={() => void loadClients()}
                        >
                            {t('retry')}
                        </button>
                    </div>
                ) : clients.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('clientsEmpty')}</p>
                    </div>
                ) : filteredClients.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('noClientResults')}</p>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t('clientColumn')}</th>
                                    <th scope="col">{t('phoneNumber')}</th>
                                    <th scope="col">{t('status')}</th>
                                    <th scope="col">{t('verification')}</th>
                                    <th scope="col">{t('createdAt')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClients.map((client) => (
                                    <tr key={client.id}>
                                        <td>
                                            <span className="client-primary">
                                                {client.fullName ?? client.email}
                                            </span>
                                            {client.fullName ? (
                                                <span className="client-secondary">{client.email}</span>
                                            ) : null}
                                        </td>
                                        <td className="muted">{client.phoneNumber ?? '—'}</td>
                                        <td>
                                            <span className={client.isActive ? 'badge active' : 'badge inactive'}>
                                                {client.isActive ? t('active') : t('inactive')}
                                            </span>
                                        </td>
                                        <td>
                                            <span
                                                className={
                                                    client.emailVerifiedAt
                                                        ? 'badge active'
                                                        : 'badge inactive'
                                                }
                                            >
                                                {client.emailVerifiedAt ? t('verified') : t('unverified')}
                                            </span>
                                        </td>
                                        <td className="muted">{formatDate(client.createdAt)}</td>
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
