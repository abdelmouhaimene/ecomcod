'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';
import { PreferenceControls } from './preference-controls';
import type { TranslationKey } from '../../lib/i18n';

function titleForPath(pathname: string): TranslationKey {
    if (pathname === '/admins') return 'navAdmins';
    if (pathname === '/change-password') return 'navChangePassword';
    return 'navOverview';
}

function initials(username: string): string {
    return username.slice(0, 2).toUpperCase();
}

export function Topbar(): React.JSX.Element {
    const { admin } = useAuth();
    const { t } = useDashboard();
    const pathname = usePathname();
    const titleKey = titleForPath(pathname);

    return (
        <header className="topbar">
            <div className="topbar-heading">
                <span className="topbar-eyebrow">{t('appName')}</span>
                <h1 className="topbar-title">{t(titleKey)}</h1>
            </div>
            <div className="topbar-actions">
                <PreferenceControls />
                {admin ? (
                    <div className="topbar-user">
                        <span className="avatar" aria-hidden="true">
                            {initials(admin.username)}
                        </span>
                        <span className="topbar-user-copy">
                            <strong className="topbar-user-name">{admin.username}</strong>
                            <span className="topbar-user-role">
                                {t(`role${admin.role.charAt(0).toUpperCase()}${admin.role.slice(1)}` as TranslationKey)}
                            </span>
                        </span>
                    </div>
                ) : null}
            </div>
        </header>
    );
}
