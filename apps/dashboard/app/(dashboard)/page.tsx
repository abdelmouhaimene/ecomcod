'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminRole } from '@repo/types';
import { adminApi } from '../../lib/admin-api';
import { useAuth } from '../../components/providers/auth-provider';
import { useDashboard } from '../../components/providers/dashboard-provider';
import type { TranslationKey } from '../../lib/i18n';

interface Stats {
    total: number;
    managers: number;
    agents: number;
}

function roleLabel(role: AdminRole): TranslationKey {
    if (role === AdminRole.SYSTEM) return 'roleSystem';
    if (role === AdminRole.MANAGER) return 'roleManager';
    return 'roleAgent';
}

export default function OverviewPage(): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();
    const [stats, setStats] = useState<Stats | null>(null);
    const [clientCount, setClientCount] = useState<number | null>(null);
    const isSystemAdmin = admin?.role === AdminRole.SYSTEM;

    useEffect(() => {
        if (!isSystemAdmin) return;

        let active = true;
        adminApi
            .list()
            .then((admins) => {
                if (!active) return;
                setStats({
                    total: admins.length,
                    managers: admins.filter((item) => item.role === AdminRole.MANAGER).length,
                    agents: admins.filter((item) => item.role === AdminRole.AGENT).length,
                });
            })
            .catch(() => {
                // The overview stays usable if the stats request fails.
            });

        return () => {
            active = false;
        };
    }, [isSystemAdmin]);

    useEffect(() => {
        let active = true;
        adminApi
            .listUsers()
            .then((users) => {
                if (active) setClientCount(users.length);
            })
            .catch(() => {
                // The overview stays usable if the client count request fails.
            });

        return () => {
            active = false;
        };
    }, []);

    const statCards = [
        { labelKey: 'totalAdmins' as TranslationKey, value: stats?.total },
        { labelKey: 'managers' as TranslationKey, value: stats?.managers },
        { labelKey: 'agents' as TranslationKey, value: stats?.agents },
    ];

    return (
        <>
            <header className="page-heading">
                <h2 className="page-title">
                    {t('welcome')}{admin ? `, ${admin.username}` : ''}
                </h2>
                <p className="page-subtitle">{t('overviewSubtitle')}</p>
            </header>

            <div className="stat-grid">
                <article className="stat-card">
                    <span className="stat-label">{t('totalClients')}</span>
                    <strong className="stat-value">{clientCount ?? '—'}</strong>
                </article>
                {statCards.map((card) => (
                    <article className="stat-card" key={card.labelKey}>
                        <span className="stat-label">{t(card.labelKey)}</span>
                        <strong className="stat-value">{card.value ?? '—'}</strong>
                    </article>
                ))}
                <article className="stat-card">
                    <span className="stat-label">{t('yourRole')}</span>
                    <strong className="stat-value role-value">
                        {admin ? t(roleLabel(admin.role)) : '—'}
                    </strong>
                    <span className="stat-note">
                        {admin?.isActive ? t('active') : t('inactive')}
                    </span>
                </article>
            </div>

            <section className="section-card" aria-labelledby="quick-actions-title">
                <h3 className="section-title" id="quick-actions-title">
                    {t('quickActions')}
                </h3>
                <div className="action-grid">
                    <Link className="action-card" href="/clients">
                        <span className="action-icon" aria-hidden="true">◉</span>
                        <span>
                            <strong className="action-title">{t('viewClients')}</strong>
                            <span className="action-description">
                                {t('viewClientsDescription')}
                            </span>
                        </span>
                        <span className="action-arrow" aria-hidden="true">→</span>
                    </Link>
                    <Link className="action-card" href="/products">
                        <span className="action-icon" aria-hidden="true">▣</span>
                        <span>
                            <strong className="action-title">{t('viewProducts')}</strong>
                            <span className="action-description">
                                {t('viewProductsDescription')}
                            </span>
                        </span>
                        <span className="action-arrow" aria-hidden="true">→</span>
                    </Link>
                    <Link className="action-card" href="/categories">
                        <span className="action-icon" aria-hidden="true">▦</span>
                        <span>
                            <strong className="action-title">{t('viewCategories')}</strong>
                            <span className="action-description">
                                {t('viewCategoriesDescription')}
                            </span>
                        </span>
                        <span className="action-arrow" aria-hidden="true">→</span>
                    </Link>
                    {isSystemAdmin ? (
                        <Link className="action-card" href="/admins">
                            <span className="action-icon" aria-hidden="true">◎</span>
                            <span>
                                <strong className="action-title">{t('manageAdmins')}</strong>
                                <span className="action-description">
                                    {t('manageAdminsDescription')}
                                </span>
                            </span>
                            <span className="action-arrow" aria-hidden="true">→</span>
                        </Link>
                    ) : null}
                    <Link className="action-card" href="/change-password">
                        <span className="action-icon" aria-hidden="true">⌁</span>
                        <span>
                            <strong className="action-title">{t('navChangePassword')}</strong>
                            <span className="action-description">
                                {t('changePasswordDescription')}
                            </span>
                        </span>
                        <span className="action-arrow" aria-hidden="true">→</span>
                    </Link>
                </div>
            </section>

            {admin ? (
                <section className="section-card narrow">
                    <h3 className="section-title">{t('account')}</h3>
                    <dl className="detail-list">
                        <div>
                            <dt>{t('username')}</dt>
                            <dd>{admin.username}</dd>
                        </div>
                        <div>
                            <dt>{t('status')}</dt>
                            <dd>{admin.isActive ? t('active') : t('inactive')}</dd>
                        </div>
                        <div>
                            <dt>{t('lastLogin')}</dt>
                            <dd>
                                {admin.lastLoginAt
                                    ? new Intl.DateTimeFormat(locale, {
                                        dateStyle: 'medium',
                                    }).format(new Date(admin.lastLoginAt))
                                    : t('never')}
                            </dd>
                        </div>
                    </dl>
                </section>
            ) : null}
        </>
    );
}
