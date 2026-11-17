'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { API_URL, ApiError, apiFetch } from '../../lib/api';
import { safeRedirectPath } from '../../lib/redirect';
import { useAuth } from '../../context/auth-context';

type Mode = 'signin' | 'signup';
type SignupStep = 'details' | 'code';
type SigninView = 'password' | 'forgot' | 'reset';
type BusyState = 'signin' | 'signup' | 'verify' | 'forgot' | 'reset' | null;

const AUTH_ERROR_KEYS = [
  'google_denied',
  'invalid_state',
  'email_unverified',
  'account_disabled',
  'google_failed',
] as const;

type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[number];

function isAuthErrorKey(value: string | null): value is AuthErrorKey {
  return value !== null && (AUTH_ERROR_KEYS as readonly string[]).includes(value);
}

const CARD_CLASS =
  'w-full max-w-md rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 gold-glow-subtle md:p-8';

const INPUT_CLASS =
  'w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 font-body-md text-[15px] text-on-surface placeholder:text-outline/60 transition-all focus:border-primary-container focus:outline-none focus:ring-1 focus:ring-primary-container/40';

const PRIMARY_BUTTON_CLASS =
  'flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-label-caps text-[11px] font-semibold uppercase tracking-[0.16em] text-on-primary transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50';

const LINK_BUTTON_CLASS =
  'font-label-caps text-[10px] uppercase tracking-[0.14em] text-on-surface-variant transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50';

const TAB_CLASS = (active: boolean) =>
  `flex-1 rounded-md px-3 py-2 font-label-caps text-[10px] uppercase tracking-[0.16em] transition-colors ${
    active
      ? 'bg-primary text-on-primary'
      : 'text-on-surface-variant hover:text-primary'
  }`;

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.88-3c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.09A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.22 7.22 0 0 1 0-4.58V6.62H1.26a11.99 11.99 0 0 0 0 10.76l4.01-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.17 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.62l4.01 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

export function LoginForm() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, status, refresh } = useAuth();

  const targetPath = safeRedirectPath(searchParams.get('redirect'));
  const nextPath = searchParams.get('next');
  const rawAuthError = searchParams.get('auth_error');

  const [mode, setMode] = React.useState<Mode>('signin');
  const [signinView, setSigninView] = React.useState<SigninView>('password');

  // Sign in
  const [signinEmail, setSigninEmail] = React.useState('');
  const [signinPassword, setSigninPassword] = React.useState('');
  const [rememberMe, setRememberMe] = React.useState(false);

  // Forgot password
  const [resetEmail, setResetEmail] = React.useState('');
  const [resetCode, setResetCode] = React.useState('');
  const [resetPassword, setResetPassword] = React.useState('');
  const [confirmResetPassword, setConfirmResetPassword] = React.useState('');

  // Sign up
  const [signupStep, setSignupStep] = React.useState<SignupStep>('details');
  const [signupEmail, setSignupEmail] = React.useState('');
  const [signupPassword, setSignupPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [sentTo, setSentTo] = React.useState('');
  const [code, setCode] = React.useState('');

  const [busy, setBusy] = React.useState<BusyState>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [interacted, setInteracted] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (status === 'authenticated' && nextPath) {
      router.replace(safeRedirectPath(nextPath));
    }
  }, [status, nextPath, router]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const authError =
    !interacted && isAuthErrorKey(rawAuthError) ? tErrors(rawAuthError) : null;

  const messageFor = (cause: unknown, kind: 'email' | 'code' | 'password' | 'signin'): string => {
    if (cause instanceof ApiError) {
      if (cause.status === 429) return tErrors('rateLimited');
      if (cause.status === 409) return tErrors('emailInUse');
      if (cause.status === 401) {
        if (kind === 'signin') return tErrors('invalidCredentials');
        return tErrors('invalidCode');
      }
      if (cause.status === 400) {
        if (kind === 'email') return tErrors('invalidEmail');
        if (kind === 'password') return tErrors('invalidPassword');
        return tErrors('invalidCode');
      }
    }
    if (cause instanceof TypeError) return tErrors('network');
    return tErrors('generic');
  };

  const resetFeedback = () => {
    setError(null);
    setInteracted(false);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setSigninView('password');
    setSignupStep('details');
    setCode('');
    setResetCode('');
    resetFeedback();
  };

  const onSignin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setInteracted(true);
    setBusy('signin');
    setError(null);
    try {
      await apiFetch('/v1/auth/login', {
        method: 'POST',
        body: {
          email: signinEmail.trim().toLowerCase(),
          password: signinPassword,
          rememberMe,
        },
      });
      await refresh();
      router.push(targetPath);
    } catch (cause) {
      setError(messageFor(cause, 'signin'));
    } finally {
      setBusy(null);
    }
  };

  const onForgotPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const address = signinEmail.trim().toLowerCase();
    if (!address) {
      setInteracted(true);
      setError(tErrors('invalidEmail'));
      return;
    }
    setInteracted(true);
    setBusy('forgot');
    setError(null);
    try {
      await apiFetch('/v1/auth/forgot-password', {
        method: 'POST',
        body: { email: address },
      });
      setResetEmail(address);
      setResetCode('');
      setSigninView('reset');
      setCooldown(60);
    } catch (cause) {
      setError(messageFor(cause, 'email'));
    } finally {
      setBusy(null);
    }
  };

  const onResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(resetCode)) {
      setInteracted(true);
      setError(tErrors('invalidCode'));
      return;
    }
    if (resetPassword.length < 8) {
      setInteracted(true);
      setError(tErrors('invalidPassword'));
      return;
    }
    if (resetPassword !== confirmResetPassword) {
      setInteracted(true);
      setError(tErrors('passwordMismatch'));
      return;
    }
    setInteracted(true);
    setBusy('reset');
    setError(null);
    try {
      await apiFetch('/v1/auth/reset-password', {
        method: 'POST',
        body: { email: resetEmail, code: resetCode, password: resetPassword },
      });
      await refresh();
      router.push(targetPath);
    } catch (cause) {
      setError(messageFor(cause, 'code'));
    } finally {
      setBusy(null);
    }
  };

  const resendReset = () => {
    if (busy || cooldown > 0) return;
    setBusy('forgot');
    setError(null);
    void apiFetch('/v1/auth/forgot-password', {
      method: 'POST',
      body: { email: resetEmail },
    })
      .then(() => setCooldown(60))
      .catch((cause) => setError(messageFor(cause, 'email')))
      .finally(() => setBusy(null));
  };

  const onSignupDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const address = signupEmail.trim().toLowerCase();
    if (!address) {
      setInteracted(true);
      setError(tErrors('invalidEmail'));
      return;
    }
    if (signupPassword.length < 8) {
      setInteracted(true);
      setError(tErrors('invalidPassword'));
      return;
    }
    if (signupPassword !== confirmPassword) {
      setInteracted(true);
      setError(tErrors('passwordMismatch'));
      return;
    }
    setInteracted(true);
    setBusy('signup');
    setError(null);
    try {
      await apiFetch('/v1/auth/signup', {
        method: 'POST',
        body: { email: address, password: signupPassword },
      });
      setSentTo(address);
      setCode('');
      setSignupStep('code');
      setCooldown(60);
    } catch (cause) {
      setError(messageFor(cause, 'email'));
    } finally {
      setBusy(null);
    }
  };

  const onVerifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) {
      setInteracted(true);
      setError(tErrors('invalidCode'));
      return;
    }
    setInteracted(true);
    setBusy('verify');
    setError(null);
    try {
      await apiFetch('/v1/auth/verify-email', {
        method: 'POST',
        body: { email: sentTo, code },
      });
      await refresh();
      router.push(targetPath);
    } catch (cause) {
      setError(messageFor(cause, 'code'));
    } finally {
      setBusy(null);
    }
  };

  const resendSignupCode = () => {
    if (busy || cooldown > 0) return;
    setBusy('signup');
    setError(null);
    void apiFetch('/v1/auth/signup', {
      method: 'POST',
      body: { email: sentTo, password: signupPassword },
    })
      .then(() => setCooldown(60))
      .catch((cause) => setError(messageFor(cause, 'email')))
      .finally(() => setBusy(null));
  };

  const changeEmail = () => {
    resetFeedback();
    setCode('');
    setSignupStep('details');
  };

  if (status === 'loading' || (status === 'authenticated' && nextPath)) {
    return (
      <div className="mx-auto w-full max-w-md px-margin py-space-xl">
        <div className={`${CARD_CLASS} flex items-center justify-center py-16`}>
          <span className="material-symbols-outlined animate-spin text-[28px] text-primary" aria-label={t('signIn')}>
            progress_activity
          </span>
        </div>
      </div>
    );
  }

  if (status === 'authenticated' && user) {
    const displayName = user.fullName?.trim() || user.email;
    const initials = displayName.charAt(0).toUpperCase();
    return (
      <div className="mx-auto w-full max-w-md px-margin py-space-xl">
        <div className={CARD_CLASS}>
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-primary-container/40 bg-primary-container/15 font-headline-md text-[22px] text-primary">
              {initials}
            </span>
            <h1 className="mt-4 font-headline-md text-[26px] leading-tight text-on-surface">{t('signedInTitle')}</h1>
            <p className="mt-1 font-body-sm text-[12px] text-on-surface-variant">{t('signedInAs')}</p>
            <p className="mt-2 font-title-md text-[15px] text-on-surface">{displayName}</p>
            {user.fullName && <p className="font-body-sm text-[12px] text-on-surface-variant">{user.email}</p>}
          </div>
          <div className="mt-8 space-y-3">
            <Link href="/" className={PRIMARY_BUTTON_CLASS}>{t('continueShopping')}</Link>
          </div>
        </div>
      </div>
    );
  }

  const googleReturnPath = `/login?next=${encodeURIComponent(targetPath)}`;
  const googleUrl = `${API_URL}/api/auth/google?redirect=${encodeURIComponent(googleReturnPath)}`;

  const showGoogle =
    (mode === 'signin' && signinView === 'password') ||
    (mode === 'signup' && signupStep === 'details');

  let heading: string;
  let subtitle: string;

  if (mode === 'signin') {
    if (signinView === 'password') {
      heading = t('signInTitle');
      subtitle = t('signinSubtitle');
    } else if (signinView === 'forgot') {
      heading = t('forgotTitle');
      subtitle = t('forgotSubtitle');
    } else {
      heading = t('resetTitle');
      subtitle = t('resetCodeSentTo', { email: resetEmail });
    }
  } else if (signupStep === 'details') {
    heading = t('title');
    subtitle = t('signupSubtitle');
  } else {
    heading = t('codeTitle');
    subtitle = t('codeSentTo', { email: sentTo });
  }

  const codeInput = (value: string, onChange: (value: string) => void, id: string) => (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      placeholder="000000"
      className={`${INPUT_CLASS} text-center font-label-numeric text-[24px] tracking-[0.4em]`}
    />
  );

  return (
    <div className="mx-auto w-full max-w-md px-margin py-space-xl">
      <div className={CARD_CLASS}>
        <div className="mb-6 flex items-center justify-between">
          <span className="font-label-caps text-[10px] uppercase tracking-[0.22em] text-primary">{t('title')}</span>
          <Link href="/" aria-label={t('backToStore')} className="text-on-surface-variant/70 transition-colors hover:text-primary">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </Link>
        </div>

        <div className="mb-5 flex gap-2 rounded-lg bg-surface-container-low p-1">
          <button type="button" onClick={() => switchMode('signin')} className={TAB_CLASS(mode === 'signin')}>
            {t('signIn')}
          </button>
          <button type="button" onClick={() => switchMode('signup')} className={TAB_CLASS(mode === 'signup')}>
            {t('createAccount')}
          </button>
        </div>

        <h1 className="font-headline-md text-[26px] leading-tight text-on-surface">{heading}</h1>
        <p className="mt-2 mb-6 font-body-sm text-[13px] leading-relaxed text-on-surface-variant">{subtitle}</p>

        {(error ?? authError) && (
          <div role="alert" className="mb-5 rounded-lg border border-error/30 bg-error-container/40 px-3 py-2.5 font-body-sm text-[12px] text-on-error-container">
            {error ?? authError}
          </div>
        )}

        {mode === 'signin' && signinView === 'password' && (
          <form onSubmit={onSignin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="signin-email" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">{t('emailLabel')}</label>
              <input id="signin-email" type="email" required autoComplete="email" autoFocus value={signinEmail} onChange={(e) => setSigninEmail(e.target.value)} placeholder={t('emailPlaceholder')} className={INPUT_CLASS} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="signin-password" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">{t('passwordLabel')}</label>
              <input id="signin-password" type="password" required autoComplete="current-password" value={signinPassword} onChange={(e) => setSigninPassword(e.target.value)} placeholder="••••••••" className={INPUT_CLASS} />
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <label htmlFor="remember-me" className="flex cursor-pointer items-center gap-2 font-body-sm text-[12px] text-on-surface-variant">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-outline-variant accent-primary"
                />
                {t('rememberMe')}
              </label>
              <button
                type="button"
                onClick={() => { resetFeedback(); setSigninView('forgot'); }}
                className={LINK_BUTTON_CLASS}
              >
                {t('forgotPassword')}
              </button>
            </div>
            <button type="submit" disabled={busy !== null} className={PRIMARY_BUTTON_CLASS}>
              {busy === 'signin' ? t('signingIn') : t('signIn')}
            </button>
          </form>
        )}

        {mode === 'signin' && signinView === 'forgot' && (
          <form onSubmit={onForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="forgot-email" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">{t('emailLabel')}</label>
              <input id="forgot-email" type="email" required autoComplete="email" autoFocus value={signinEmail} onChange={(e) => setSigninEmail(e.target.value)} placeholder={t('emailPlaceholder')} className={INPUT_CLASS} />
            </div>
            <button type="submit" disabled={busy !== null} className={PRIMARY_BUTTON_CLASS}>
              {busy === 'forgot' ? t('sendingCode') : t('sendResetCode')}
            </button>
            <div className="pt-1">
              <button type="button" onClick={() => { resetFeedback(); setSigninView('password'); }} className={LINK_BUTTON_CLASS}>
                {t('backToSignIn')}
              </button>
            </div>
          </form>
        )}

        {mode === 'signin' && signinView === 'reset' && (
          <form onSubmit={onResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reset-code" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">{t('codeLabel')}</label>
              {codeInput(resetCode, setResetCode, 'reset-code')}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reset-password" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">{t('newPasswordLabel')}</label>
              <input id="reset-password" type="password" required autoComplete="new-password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="••••••••" className={INPUT_CLASS} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reset-confirm" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">{t('confirmPasswordLabel')}</label>
              <input id="reset-confirm" type="password" required autoComplete="new-password" value={confirmResetPassword} onChange={(e) => setConfirmResetPassword(e.target.value)} placeholder="••••••••" className={INPUT_CLASS} />
            </div>
            <button type="submit" disabled={busy !== null} className={PRIMARY_BUTTON_CLASS}>
              {busy === 'reset' ? t('resettingPassword') : t('resetPasswordButton')}
            </button>
            <div className="flex items-center justify-between gap-3 pt-1">
              <button type="button" onClick={() => { resetFeedback(); setSigninView('password'); }} className={LINK_BUTTON_CLASS}>
                {t('backToSignIn')}
              </button>
              <button type="button" onClick={resendReset} disabled={busy !== null || cooldown > 0} className={LINK_BUTTON_CLASS}>
                {cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
              </button>
            </div>
          </form>
        )}

        {mode === 'signup' && signupStep === 'details' && (
          <form onSubmit={onSignupDetails} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="signup-email" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">{t('emailLabel')}</label>
              <input id="signup-email" type="email" required autoComplete="email" autoFocus value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} placeholder={t('emailPlaceholder')} className={INPUT_CLASS} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="signup-password" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">{t('passwordLabel')}</label>
              <input id="signup-password" type="password" required autoComplete="new-password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} placeholder="••••••••" className={INPUT_CLASS} />
              <p className="font-body-sm text-[11px] text-on-surface-variant">{t('passwordHint')}</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="signup-confirm" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">{t('confirmPasswordLabel')}</label>
              <input id="signup-confirm" type="password" required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={INPUT_CLASS} />
            </div>
            <button type="submit" disabled={busy !== null} className={PRIMARY_BUTTON_CLASS}>
              {busy === 'signup' ? t('sendingCode') : t('sendCode')}
            </button>
          </form>
        )}

        {mode === 'signup' && signupStep === 'code' && (
          <form onSubmit={onVerifyCode} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="signup-code" className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">{t('codeLabel')}</label>
              {codeInput(code, setCode, 'signup-code')}
            </div>
            <button type="submit" disabled={busy !== null} className={PRIMARY_BUTTON_CLASS}>
              {busy === 'verify' ? t('verifying') : t('createAccountButton')}
            </button>
            <div className="flex items-center justify-between gap-3 pt-1">
              <button type="button" onClick={changeEmail} className={LINK_BUTTON_CLASS}>{t('changeEmail')}</button>
              <button type="button" onClick={resendSignupCode} disabled={busy !== null || cooldown > 0} className={LINK_BUTTON_CLASS}>
                {cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
              </button>
            </div>
          </form>
        )}

        {showGoogle && (
          <>
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-outline-variant/50" />
              <span className="font-label-caps text-[10px] uppercase tracking-[0.2em] text-outline">{t('or')}</span>
              <span className="h-px flex-1 bg-outline-variant/50" />
            </div>
            <a href={googleUrl} className="flex w-full items-center justify-center gap-3 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 font-label-caps text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface transition-colors hover:border-primary-container/60 hover:bg-surface-container-low">
              <GoogleIcon /> {t('continueWithGoogle')}
            </a>
            {mode === 'signup' && (
              <p className="mt-3 text-center font-body-sm text-[11px] text-on-surface-variant">
                {t('googleSignupHint')}
              </p>
            )}
          </>
        )}

        <Link href="/" className="mt-7 inline-flex items-center gap-1.5 font-label-caps text-[10px] uppercase tracking-[0.18em] text-on-surface-variant transition-colors hover:text-primary">
          <span className="material-symbols-outlined text-[16px] rtl:rotate-180">arrow_back</span>
          {t('backToStore')}
        </Link>
      </div>
    </div>
  );
}
