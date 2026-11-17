'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '../../components/auth/login-form';
import { PreferenceControls } from '../../components/layout/preference-controls';
import { useAuth } from '../../components/providers/auth-provider';
import { useDashboard } from '../../components/providers/dashboard-provider';

export default function LoginPage(): React.JSX.Element {
    const { status } = useAuth();
    const { t } = useDashboard();
    const router = useRouter();

    useEffect(() => {
        if (status === 'authenticated') router.replace('/');
    }, [status, router]);

    if (status !== 'anonymous') {
        return (
            <main className="auth-layout">
                <div className="state-card">
                    <span className="state-spinner" aria-hidden="true" />
                    <p className="state-title">{t('checkingSession')}</p>
                </div>
            </main>
        );
    }

    return (
        <main className="auth-layout">
            <section className="auth-card" aria-labelledby="login-title">
                <div className="auth-header">
                    <div>
                        <span className="auth-brand">{t('appName')}</span>
                        <h1 className="auth-title" id="login-title">
                            {t('signInTitle')}
                        </h1>
                        <p className="auth-subtitle">{t('signInSubtitle')}</p>
                    </div>
                    <div className="auth-controls">
                        <PreferenceControls />
                    </div>
                </div>
                <LoginForm onSuccess={() => router.replace('/')} />
            </section>
        </main>
    );
}
