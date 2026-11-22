'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminRole } from '@repo/types';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';
import type { TranslationKey } from '../../lib/i18n';

interface NavItem {
    href: string;
    labelKey: TranslationKey;
    icon: ReactNode;
    systemOnly?: boolean;
}

const navItems: NavItem[] = [
    {
        href: '/',
        labelKey: 'navOverview',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 10.5 12 4l8 6.5V20h-6v-6h-4v6H4z" />
            </svg>
        ),
    },
    {
        href: '/clients',
        labelKey: 'navClients',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="9" cy="8" r="3.2" />
                <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 6M17 14.2a5.5 5.5 0 0 1 3.5 4.8" />
            </svg>
        ),
    },
    {
        href: '/products',
        labelKey: 'navProducts',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
                <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
            </svg>
        ),
    },
    {
        href: '/categories',
        labelKey: 'navCategories',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h6v6H4zM14 5h6v6h-6zM4 14h6v5H4zM14 14h6v5h-6z" />
            </svg>
        ),
    },
    {
        href: '/families',
        labelKey: 'navFamilies',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="6" cy="6" r="2.2" />
                <circle cx="18" cy="6" r="2.2" />
                <circle cx="12" cy="18" r="2.2" />
                <path d="M7.8 7.6 10.6 16M16.2 7.6 13.4 16M8.2 6h7.6" />
            </svg>
        ),
    },
    {
        href: '/offers',
        labelKey: 'navOffers',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 12 12 20 4 12V4h8z" />
                <circle cx="8.5" cy="8.5" r="1.4" />
            </svg>
        ),
    },
    {
        href: '/pos',
        labelKey: 'navPos',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M7 7h10M7 11h10M7 15h4M16 15h1" />
            </svg>
        ),
    },
    {
        href: '/stock',
        labelKey: 'navStock',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3.5 8.5 12 4l8.5 4.5v7L12 20l-8.5-4.5z" />
                <path d="M3.5 8.5 12 13l8.5-4.5M12 13v7M7.5 6.2l8.5 4.5" />
            </svg>
        ),
    },
    {
        href: '/suppliers',
        labelKey: 'navSuppliers',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3.5 8.5 12 4l8.5 4.5v7L12 20l-8.5-4.5z" />
                <path d="M7.5 10.5h9M7.5 13.5h5" />
            </svg>
        ),
    },
    {
        href: '/admins',
        labelKey: 'navAdmins',
        systemOnly: true,
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M16 4.2a3.5 3.5 0 0 1 0 6.6" />
            </svg>
        ),
    },
    {
        href: '/profile',
        labelKey: 'navProfile',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
        ),
    },
];

function initials(username: string): string {
    return username.slice(0, 2).toUpperCase();
}

export function Sidebar(): React.JSX.Element {
    const { admin, logout } = useAuth();
    const { t } = useDashboard();
    const pathname = usePathname();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
        } finally {
            setIsLoggingOut(false);
        }
    };

    const visibleItems = navItems.filter(
        (item) => !item.systemOnly || admin?.role === AdminRole.SYSTEM,
    );

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <span className="brand-mark" aria-hidden="true">EC</span>
                <span className="brand-copy">
                    <strong className="brand-name">{t('appName')}</strong>
                    <span className="brand-subtitle">{t('appSubtitle')}</span>
                </span>
            </div>

            <nav className="sidebar-nav" aria-label={t('appName')}>
                <p className="sidebar-section-label">{t('account')}</p>
                <ul className="nav-list">
                    {visibleItems.map((item) => {
                        const active = pathname === item.href;
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={active ? 'nav-link active' : 'nav-link'}
                                    aria-current={active ? 'page' : undefined}
                                    title={t(item.labelKey)}
                                >
                                    <span className="nav-icon">{item.icon}</span>
                                    <span className="nav-label">{t(item.labelKey)}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-profile">
                    {admin ? (
                        <div className="sidebar-admin">
                            <span className="avatar" aria-hidden="true">
                                {initials(admin.username)}
                            </span>
                            <span className="admin-meta">
                                <strong className="admin-name">{admin.username}</strong>
                                <span className="admin-role">
                                    {t(`role${admin.role.charAt(0).toUpperCase()}${admin.role.slice(1)}` as TranslationKey)}
                                </span>
                            </span>
                        </div>
                    ) : null}
                    <button
                        type="button"
                        className="logout-button"
                        onClick={() => void handleLogout()}
                        disabled={isLoggingOut}
                        title={t('logout')}
                        aria-label={isLoggingOut ? t('loggingOut') : t('logout')}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="nav-label">
                            {isLoggingOut ? t('loggingOut') : t('logout')}
                        </span>
                    </button>
                </div>
            </div>
        </aside>
    );
}
