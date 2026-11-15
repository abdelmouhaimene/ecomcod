'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../context/auth-context';

export function AccountMenu() {
  const t = useTranslations('auth');
  const tNav = useTranslations('nav');
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const signOut = async () => {
    setBusy(true);
    try {
      await logout();
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <span aria-hidden="true" className="p-1.5 text-primary/40">
        <span className="material-symbols-outlined animate-pulse text-[22px]">person</span>
      </span>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        aria-label={tNav('account')}
        className="rounded p-1.5 text-primary transition-all duration-200 hover:bg-surface-container-low hover:text-primary active:scale-95"
      >
        <span className="material-symbols-outlined text-[22px]">person</span>
      </Link>
    );
  }

  const displayName = user.fullName?.trim() || user.email;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={tNav('account')}
        aria-expanded={open}
        className="rounded p-1.5 text-primary transition-all duration-200 hover:bg-surface-container-low hover:text-primary active:scale-95"
      >
        <span
          className="material-symbols-outlined text-[22px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          account_circle
        </span>
      </button>

      {open && (
        <div className="absolute end-0 z-[60] mt-2 w-60 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-3 shadow-xl">
          <p className="font-label-caps text-[9px] uppercase tracking-[0.18em] text-on-surface-variant">
            {t('signedInAs')}
          </p>
          <p className="mt-1 truncate font-title-md text-[14px] text-on-surface">{displayName}</p>
          {user.fullName && (
            <p className="truncate font-body-sm text-[11px] text-on-surface-variant">
              {user.email}
            </p>
          )}

          <button
            type="button"
            onClick={signOut}
            disabled={busy}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-outline-variant/60 px-3 py-2 font-label-caps text-[10px] uppercase tracking-[0.14em] text-on-surface-variant transition-colors hover:border-error/40 hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[15px]">logout</span>
            {busy ? t('signingOut') : t('signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
