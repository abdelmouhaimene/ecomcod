'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { adminApi } from '../../lib/admin-api';
import { useDashboard } from '../providers/dashboard-provider';

export function ChangePasswordForm(): React.JSX.Element {
    const { t } = useDashboard();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        if (newPassword.length < 8) {
            setError(t('passwordTooShort'));
            return;
        }
        if (newPassword !== confirmPassword) {
            setError(t('passwordsDoNotMatch'));
            return;
        }

        setBusy(true);
        try {
            await adminApi.changePassword({ currentPassword, newPassword });
            setSuccess(t('passwordUpdated'));
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : t('error'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="form-stack" onSubmit={(event) => void handleSubmit(event)}>
            <div className="field">
                <label className="field-label" htmlFor="current-password">
                    {t('currentPassword')}
                </label>
                <input
                    id="current-password"
                    className="field-input"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                />
            </div>

            <div className="field-grid">
                <div className="field">
                    <label className="field-label" htmlFor="new-password">
                        {t('newPassword')}
                    </label>
                    <input
                        id="new-password"
                        className="field-input"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        required
                    />
                    <p className="field-hint">{t('passwordHint')}</p>
                </div>
                <div className="field">
                    <label className="field-label" htmlFor="confirm-password">
                        {t('confirmPassword')}
                    </label>
                    <input
                        id="confirm-password"
                        className="field-input"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        required
                    />
                </div>
            </div>

            {error ? (
                <p className="form-error" role="alert">
                    {error}
                </p>
            ) : null}
            {success ? (
                <p className="form-success" role="status">
                    {success}
                </p>
            ) : null}

            <div className="form-actions">
                <button type="submit" className="button primary" disabled={busy}>
                    {busy ? t('updatingPassword') : t('updatePassword')}
                </button>
            </div>
        </form>
    );
}
