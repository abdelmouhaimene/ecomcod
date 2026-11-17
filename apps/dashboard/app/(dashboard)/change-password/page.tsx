'use client';

import { ChangePasswordForm } from '../../../components/auth/change-password-form';
import { useDashboard } from '../../../components/providers/dashboard-provider';

function ChangePasswordContent(): React.JSX.Element {
    const { t } = useDashboard();

    return (
        <>
            <header className="page-heading">
                <h2 className="page-title">{t('changePasswordTitle')}</h2>
                <p className="page-subtitle">{t('changePasswordSubtitle')}</p>
            </header>
            <section className="section-card narrow" aria-labelledby="change-password-section-title">
                <h3 className="section-title" id="change-password-section-title">
                    {t('password')}
                </h3>
                <ChangePasswordForm />
            </section>
        </>
    );
}

export default function ChangePasswordPage(): React.JSX.Element {
    return <ChangePasswordContent />;
}
