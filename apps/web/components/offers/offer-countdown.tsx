'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

/** A small live countdown so the whole offers list never re-renders every tick. */
export function OfferCountdown({ endsAt }: { endsAt: string | null }) {
  const t = useTranslations('home');
  const [remaining, setRemaining] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!endsAt) {
      setRemaining(null);
      return;
    }
    const target = new Date(endsAt).getTime();
    if (Number.isNaN(target)) {
      setRemaining(null);
      return;
    }

    const update = () => setRemaining(Math.max(0, target - Date.now()));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [endsAt]);

  const pad = (value: number) => String(value).padStart(2, '0');

  if (!endsAt) {
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-surface-container text-secondary font-label-caps text-[9px] tracking-wider">
        <span className="material-symbols-outlined text-[12px]">schedule</span>
        <span>{t('offers.noEndDate')}</span>
      </span>
    );
  }

  if (remaining === null) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container text-secondary font-label-caps text-[9px] tracking-wider">
        …
      </span>
    );
  }

  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded bg-error-container text-error font-label-caps text-[9px] tracking-wider">
        {t('offers.ended')}
      </span>
    );
  }

  const seconds = Math.floor(remaining / 1000);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded bg-on-surface text-surface-container-lowest font-label-caps text-[9px] tracking-wider">
      <strong className="font-label-numeric font-bold text-primary-fixed-dim">
        {t('offers.timeLeft', {
          days: pad(Math.floor(seconds / 86400)),
          hours: pad(Math.floor((seconds % 86400) / 3600)),
          minutes: pad(Math.floor((seconds % 3600) / 60)),
          seconds: pad(seconds % 60),
        })}
      </strong>
    </span>
  );
}
