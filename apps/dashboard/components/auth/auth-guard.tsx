'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../providers/dashboard-provider';
import { useAuth } from '../providers/auth-provider';

export function AuthGuard({ children }: { children: ReactNode }): React.JSX.Element {
    const { status } = useAuth();
    const { t } = useDashboard();
    const router = useRouter();

    useEffect(() => {
        if (status === 'anonymous') router.replace('/login');
    }, [status, router]);

    if (status !== 'authenticated') {
        return (
            <div className="center-state">
                <div className="state-card">
                    <span className="state-spinner" aria-hidden="true" />
                    <p className="state-title">{t('checkingSession')}</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
