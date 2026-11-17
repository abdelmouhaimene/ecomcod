'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';

interface LoginFormProps {
    onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps): React.JSX.Element {
    const { login } = useAuth();
    const { t } = useDashboard();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!username.trim() || !password) {
            setError(t('required'));
            return;
        }

        setBusy(true);
        setError(null);
        try {
            await login({ username: username.trim(), password, rememberMe });
            onSuccess();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : t('invalidCredentialsFallback'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="form-stack" onSubmit={(event) => void handleSubmit(event)}>
            <div className="field">
                <label className="field-label" htmlFor="login-username">
                    {t('username')}
                </label>
                <input
                    id="login-username"
                    className="field-input"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    required
                />
            </div>

            <div className="field">
                <label className="field-label" htmlFor="login-password">
                    {t('password')}
                </label>
                <input
                    id="login-password"
                    className="field-input"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                />
            </div>

            <label className="checkbox-field" htmlFor="login-remember">
                <input
                    id="login-remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>{t('rememberMe')}</span>
            </label>

            {error ? (
                <p className="form-error" role="alert">
                    {error}
                </p>
            ) : null}

            <button type="submit" className="button primary block" disabled={busy}>
                {busy ? t('signingIn') : t('signIn')}
            </button>
        </form>
    );
}
