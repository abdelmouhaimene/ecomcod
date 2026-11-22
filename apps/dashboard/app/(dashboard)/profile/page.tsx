'use client';

import { ChangePasswordForm } from '../../../components/auth/change-password-form';
import { useAuth } from '../../../components/providers/auth-provider';
import { useDashboard } from '../../../components/providers/dashboard-provider';
import type { TranslationKey } from '../../../lib/i18n';

function ProfileContent(): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();

    const formatDate = (value: string | null): string =>
        value
            ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
            : t('never');

    return (
        <>
            <header className="page-heading">
                <h2 className="page-title">{t('profileTitle')}</h2>
                <p className="page-subtitle">{t('profileSubtitle')}</p>
            </header>

            {admin ? (
                <div className="profile-grid">
                    <section className="section-card" aria-labelledby="profile-information-title">
                        <h3 className="section-title" id="profile-information-title">
                            {t('profileInformation')}
                        </h3>
                        <dl className="detail-list">
                            <div>
                                <dt>{t('username')}</dt>
                                <dd>{admin.username}</dd>
                            </div>
                            <div>
                                <dt>{t('role')}</dt>
                                <dd>
                                    {t(`role${admin.role.charAt(0).toUpperCase()}${admin.role.slice(1)}` as TranslationKey)}
                                </dd>
                            </div>
                            <div>
                                <dt>{t('accountStatus')}</dt>
                                <dd>{admin.isActive ? t('active') : t('inactive')}</dd>
                            </div>
                            <div>
                                <dt>{t('lastLogin')}</dt>
                                <dd>{formatDate(admin.lastLoginAt)}</dd>
                            </div>
                            <div>
                                <dt>{t('createdAt')}</dt>
                                <dd>{formatDate(admin.createdAt)}</dd>
                            </div>
                            <div>
                                <dt>{t('profileUpdatedAt')}</dt>
                                <dd>{formatDate(admin.updatedAt)}</dd>
                            </div>
                        </dl>
                    </section>

                    <section className="section-card" aria-labelledby="profile-password-title">
                        <h3 className="section-title" id="profile-password-title">
                            {t('profilePasswordPanel')}
                        </h3>
                        <ChangePasswordForm />
                    </section>
                </div>
            ) : (
                <div className="center-state">
                    <div className="state-card">
                        <span className="state-spinner" aria-hidden="true" />
                        <p className="state-title">{t('checkingSession')}</p>
                    </div>
                </div>
            )}
        </>
    );
}

export default function ProfilePage(): React.JSX.Element {
    return <ProfileContent />;
}
