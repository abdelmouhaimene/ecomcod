'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiError, apiFetch } from '../../lib/api';
import { useAuth } from '../../context/auth-context';

const CARD_CLASS =
  'w-full max-w-2xl rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 gold-glow-subtle md:p-8';

const INPUT_CLASS =
  'w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 font-body-md text-[15px] text-on-surface placeholder:text-outline/60 transition-all focus:border-primary-container focus:outline-none focus:ring-1 focus:ring-primary-container/40';

const PRIMARY_BUTTON_CLASS =
  'flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-label-caps text-[11px] font-semibold uppercase tracking-[0.16em] text-on-primary transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50';

export default function ProfilePage() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const { user, status, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (status === 'anonymous') {
      router.replace('/login?next=/profile');
    }
  }, [status, router]);

  if (status === 'loading' || status === 'anonymous') {
    return (
      <div className="mx-auto w-full max-w-2xl px-margin py-space-xl">
        <div className={`${CARD_CLASS} flex items-center justify-center py-16`}>
          <span className="material-symbols-outlined animate-spin text-[28px] text-primary" aria-hidden="true">
            progress_activity
          </span>
        </div>
      </div>
    );
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setMessage(null);

    if (newPassword.length < 8) {
      setError(tErrors('invalidPassword'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(tErrors('passwordMismatch'));
      return;
    }

    if (!currentPassword) {
      setError(tErrors('currentPasswordRequired'));
      return;
    }

    setBusy(true);
    try {
      await apiFetch('/v1/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setMessage(t('passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.status === 400) setError(cause.message);
        else if (cause.status === 401) setError(tErrors('invalidCredentials'));
        else setError(tErrors('generic'));
      } else {
        setError(tErrors('network'));
      }
    } finally {
      setBusy(false);
    }
  };

  const displayName = user?.fullName?.trim() || user?.email || '';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-2xl px-margin py-space-xl">
      <div className={CARD_CLASS}>
        <div className="mb-6 flex items-center justify-between">
          <span className="font-label-caps text-[10px] uppercase tracking-[0.22em] text-primary">{t('profileTitle')}</span>
          <Link href="/" aria-label={t('backToStore')} className="text-on-surface-variant/70 transition-colors hover:text-primary">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-primary-container/40 bg-primary-container/15 font-headline-md text-[22px] text-primary">
            {initials}
          </span>
          <div>
            <h1 className="font-headline-md text-[22px] leading-tight text-on-surface">{displayName}</h1>
            <p className="font-body-sm text-[12px] text-on-surface-variant">{user?.email}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
            <p className="font-label-caps text-[9px] uppercase tracking-[0.18em] text-on-surface-variant">{t('fullName')}</p>
            <p className="mt-1 font-body-md text-[14px] text-on-surface">{user?.fullName || '—'}</p>
          </div>
          <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
            <p className="font-label-caps text-[9px] uppercase tracking-[0.18em] text-on-surface-variant">{t('emailLabel')}</p>
            <p className="mt-1 font-body-md text-[14px] text-on-surface">{user?.email}</p>
          </div>
          <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
            <p className="font-label-caps text-[9px] uppercase tracking-[0.18em] text-on-surface-variant">{t('phone')}</p>
            <p className="mt-1 font-body-md text-[14px] text-on-surface">{user?.phoneNumber || '—'}</p>
          </div>
          <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
            <p className="font-label-caps text-[9px] uppercase tracking-[0.18em] text-on-surface-variant">{t('memberSince')}</p>
            <p className="mt-1 font-body-md text-[14px] text-on-surface">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-outline-variant/30 pt-6">
          <h2 className="font-headline-md text-[18px] text-on-surface">
            {user?.hasPassword ? t('changePasswordTitle') : t('passwordUnavailableTitle')}
          </h2>
          <p className="mt-1 mb-4 font-body-sm text-[12px] text-on-surface-variant">
            {user?.hasPassword ? t('changePasswordSubtitle') : t('passwordUnavailableBody')}
          </p>

          {user?.hasPassword && (
            <>
              {(error ?? message) && (
                <div
                  role="alert"
                  className={`mb-5 rounded-lg border px-3 py-2.5 font-body-sm text-[12px] ${
                    error
                      ? 'border-error/30 bg-error-container/40 text-on-error-container'
                      : 'border-primary/30 bg-primary-container/15 text-on-surface'
                  }`}
                >
                  {error ?? message}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="current-password" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
                    {t('currentPasswordLabel')}
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className={INPUT_CLASS}
                  />
                  <p className="font-body-sm text-[11px] text-on-surface-variant">{t('currentPasswordHint')}</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="new-password" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
                    {t('newPasswordLabel')}
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="confirm-new-password" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
                    {t('confirmPasswordLabel')}
                  </label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={INPUT_CLASS}
                  />
                </div>
                <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>
                  {busy ? t('updatingPassword') : t('updatePassword')}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-8 border-t border-outline-variant/30 pt-6">
          <button
            type="button"
            onClick={async () => { await logout(); router.push('/'); }}
            className="font-label-caps text-[10px] uppercase tracking-[0.14em] text-error transition-colors hover:underline"
          >
            {t('signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}