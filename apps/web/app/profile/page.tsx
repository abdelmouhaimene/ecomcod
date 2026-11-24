'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ApiError, apiFetch } from '../../lib/api';
import { useAuth } from '../../context/auth-context';
import {
  communesForWilaya,
  fetchLocationData,
  localizedLocationName,
  normalizeAlgerianPhone,
  type CommuneOption,
  type WilayaOption,
} from '../../lib/locations';

const CARD_CLASS =
  'w-full max-w-2xl rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 gold-glow-subtle md:p-8';

const INPUT_CLASS =
  'w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 font-body-md text-[15px] text-on-surface placeholder:text-outline/60 transition-all focus:border-primary-container focus:outline-none focus:ring-1 focus:ring-primary-container/40';

const PRIMARY_BUTTON_CLASS =
  'flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-label-caps text-[11px] font-semibold uppercase tracking-[0.16em] text-on-primary transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50';

export default function ProfilePage() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('auth.errors');
  const locale = useLocale();
  const router = useRouter();
  const { user, status, refresh, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [fullName, setFullName] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [wilayaCode, setWilayaCode] = React.useState('');
  const [communeCode, setCommuneCode] = React.useState('');
  const [wilayas, setWilayas] = React.useState<WilayaOption[]>([]);
  const [communes, setCommunes] = React.useState<CommuneOption[]>([]);
  const [locationDataError, setLocationDataError] = React.useState(false);
  const [profileBusy, setProfileBusy] = React.useState(false);
  const [profileMessage, setProfileMessage] = React.useState<string | null>(null);
  const [profileError, setProfileError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (status === 'anonymous') {
      router.replace('/login?next=/profile');
    }
  }, [status, router]);

  React.useEffect(() => {
    if (!user) return;
    setFullName(user.fullName ?? '');
    setPhoneNumber(user.phoneNumber ?? '');
    setWilayaCode(user.wilayaCode ?? '');
    setCommuneCode(user.communeCode ?? '');
  }, [user?.id]);

  React.useEffect(() => {
    let cancelled = false;
    void fetchLocationData()
      .then(({ wilayas: list, communes: towns }) => {
        if (cancelled) return;
        setWilayas(list);
        setCommunes(towns);
      })
      .catch(() => {
        if (!cancelled) setLocationDataError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableCommunes = React.useMemo(
    () => communesForWilaya(communes, wilayaCode, locale),
    [communes, locale, wilayaCode]
  );
  const selectedWilaya = wilayas.find((wilaya) => wilaya.code === wilayaCode) ?? null;
  const selectedCommune =
    availableCommunes.find((commune) => commune.code === communeCode) ?? null;

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

  const onProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (profileBusy) return;
    setProfileError(null);
    setProfileMessage(null);

    const name = fullName.trim();
    const normalizedPhone = normalizeAlgerianPhone(phoneNumber);
    if (!name) {
      setProfileError(t('profileNameRequired'));
      return;
    }
    if (!normalizedPhone) {
      setProfileError(t('profilePhoneInvalid'));
      return;
    }
    if (!selectedWilaya) {
      setProfileError(t('profileWilayaRequired'));
      return;
    }
    if (!selectedCommune) {
      setProfileError(t('profileCommuneRequired'));
      return;
    }

    setProfileBusy(true);
    try {
      await apiFetch<unknown>('/v1/auth/me', {
        method: 'PATCH',
        body: {
          fullName: name,
          phoneNumber: normalizedPhone,
          wilayaCode: selectedWilaya.code,
          wilayaName: localizedLocationName(selectedWilaya, locale),
          communeCode: selectedCommune.code,
          communeName: localizedLocationName(selectedCommune, locale),
        },
      });
      await refresh();
      setProfileMessage(t('profileUpdated'));
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.status === 400 || cause.status === 422) setProfileError(cause.message);
        else if (cause.status === 401) setProfileError(tErrors('invalidCredentials'));
        else setProfileError(tErrors('generic'));
      } else {
        setProfileError(tErrors('network'));
      }
    } finally {
      setProfileBusy(false);
    }
  };

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
            <p className="font-label-caps text-[9px] uppercase tracking-[0.18em] text-on-surface-variant">{t('wilaya')}</p>
            <p className="mt-1 font-body-md text-[14px] text-on-surface">{user?.wilayaName || '—'}</p>
          </div>
          <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
            <p className="font-label-caps text-[9px] uppercase tracking-[0.18em] text-on-surface-variant">{t('commune')}</p>
            <p className="mt-1 font-body-md text-[14px] text-on-surface">{user?.communeName || '—'}</p>
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
            {t('contactDetailsTitle')}
          </h2>
          <p className="mt-1 mb-4 font-body-sm text-[12px] text-on-surface-variant">
            {t('contactDetailsSubtitle')}
          </p>

          {(profileError ?? profileMessage) && (
            <div
              role="alert"
              className={`mb-5 rounded-lg border px-3 py-2.5 font-body-sm text-[12px] ${
                profileError
                  ? 'border-error/30 bg-error-container/40 text-on-error-container'
                  : 'border-primary/30 bg-primary-container/15 text-on-surface'
              }`}
            >
              {profileError ?? profileMessage}
            </div>
          )}

          <form onSubmit={onProfileSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="profile-full-name" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
                {t('fullName')}
              </label>
              <input
                id="profile-full-name"
                type="text"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('profileNamePlaceholder')}
                maxLength={100}
                disabled={profileBusy}
                className={INPUT_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="profile-phone" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
                {t('phone')}
              </label>
              <input
                id="profile-phone"
                type="tel"
                inputMode="tel"
                required
                autoComplete="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder={t('profilePhonePlaceholder')}
                disabled={profileBusy}
                className={INPUT_CLASS}
              />
              <p className="font-body-sm text-[11px] text-on-surface-variant">{t('profilePhoneHint')}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="profile-wilaya" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
                  {t('wilaya')}
                </label>
                <select
                  id="profile-wilaya"
                  required
                  value={wilayaCode}
                  onChange={(e) => {
                    setWilayaCode(e.target.value);
                    setCommuneCode('');
                  }}
                  disabled={profileBusy || wilayas.length === 0}
                  autoComplete="address-level1"
                  className={INPUT_CLASS}
                >
                  <option value="">{t('profileSelectWilaya')}</option>
                  {wilayas.map((wilaya) => (
                    <option key={wilaya.code} value={wilaya.code}>
                      {localizedLocationName(wilaya, locale)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="profile-commune" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
                  {t('commune')}
                </label>
                <select
                  id="profile-commune"
                  required
                  value={communeCode}
                  onChange={(e) => setCommuneCode(e.target.value)}
                  disabled={profileBusy || availableCommunes.length === 0}
                  autoComplete="address-level2"
                  className={INPUT_CLASS}
                >
                  <option value="">{t('profileSelectCommune')}</option>
                  {availableCommunes.map((commune) => (
                    <option key={commune.code} value={commune.code}>
                      {localizedLocationName(commune, locale)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {locationDataError && (
              <p className="font-body-sm text-[11px] text-error">{t('profileLocationUnavailable')}</p>
            )}

            <button type="submit" disabled={profileBusy} className={PRIMARY_BUTTON_CLASS}>
              {profileBusy ? t('updatingProfile') : t('updateProfile')}
            </button>
          </form>
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