'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useStore } from '../../context/store-context';

export function CuratedDrops() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const { addToCart } = useStore();

  const [timeLeft, setTimeLeft] = React.useState({
    hours: 18,
    minutes: 42,
    seconds: 10,
  });

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        }
        if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        }
        if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDigits = (n: number) => n.toString().padStart(2, '0');

  return (
    <section className="w-full px-margin overflow-hidden max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-3.5 bg-primary-container rounded-full"></span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {t('curatedDrops')}
          </h2>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-4 h-1 bg-primary rounded-full"></span>
          <span className="w-1.5 h-1 bg-outline-variant rounded-full"></span>
          <span className="w-1.5 h-1 bg-outline-variant rounded-full"></span>
        </div>
      </div>

      {/* Side-Peek Horizontal Carousel */}
      <div className="flex space-x-4 overflow-x-auto no-scrollbar py-2 -mx-margin px-margin snap-x snap-mandatory">
        {/* Primary Featured Banner Card: Aura Pro Studio */}
        <article className="min-w-[88vw] sm:min-w-[440px] md:min-w-[480px] max-w-[88vw] sm:max-w-[480px] flex-shrink-0 snap-center rounded-xl bg-surface-container-lowest border border-primary-container/40 p-4 gold-glow-subtle flex flex-col relative overflow-hidden transition-all duration-300 hover:border-primary-container">
          <div className="absolute -right-12 -top-12 w-36 h-36 bg-primary-container/10 rounded-full blur-2xl pointer-events-none"></div>

          {/* Top Meta Row */}
          <div className="flex items-center justify-between mb-3 z-10">
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-surface border border-primary-container rounded text-primary font-label-caps text-[10px] font-semibold tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
              <span>{t('exclusiveOffer')}</span>
            </span>
            {/* Countdown Chip */}
            <div className="flex items-center space-x-1 px-2 py-0.5 bg-on-surface text-on-primary rounded font-label-numeric text-[11px]">
              <span className="material-symbols-outlined text-[13px] text-primary-fixed-dim">
                timer
              </span>
              <span>
                {formatDigits(timeLeft.hours)}h : {formatDigits(timeLeft.minutes)}m :{' '}
                {formatDigits(timeLeft.seconds)}s
              </span>
            </div>
          </div>

          {/* Hero Product Image */}
          <Link
            href="/products/aura-pro-studio"
            className="w-full h-48 sm:h-56 rounded-lg bg-surface-container-low overflow-hidden relative mb-3.5 flex items-center justify-center border border-outline-variant/20 group"
          >
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDefNvKqWidcB0wR0J63ZS9pIz9biCxBeqfMItgRNMgXE9RMSIRV7vkTXCXuwI90Lo6LiU85Nmx8CFpO_2nCrSEG46ava6UHd0TILvlMRjCxhu7PlwbjDhNPZCZas6AQ7VokGDwABxKtoe3el9pVylHTE-Di7qAjzqWX5TQ5YRLJpZB7N8UKrugLE8MuCnUVlcovsXNl2c0X2hEj66Tww1Z7xGirmQ7wt2h3rWgbaIK4YQeIgZMV-p0lw"
              alt="Aura Pro Studio Wireless Headphones"
              className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
            />
            <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-on-surface/90 text-surface-container-lowest rounded font-label-caps text-[9px] tracking-widest backdrop-blur-sm">
              {t('edition01')}
            </span>
          </Link>

          {/* Product Details */}
          <div className="flex flex-col flex-1 justify-between z-10">
            <div>
              <p className="font-label-caps text-label-caps text-primary uppercase tracking-widest mb-0.5">
                {t('acousticMastery')}
              </p>
              <Link href="/products/aura-pro-studio">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-tight hover:text-primary transition-colors">
                  {t('heroProductTitle')}
                </h3>
              </Link>
              <p className="font-body-sm text-body-sm text-on-surface-variant/80 mt-1 line-clamp-2">
                {t('heroProductDesc')}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-outline-variant/30 flex items-center justify-between">
              <div>
                <span className="font-label-caps text-[10px] text-outline uppercase block">
                  {t('currentTier')}
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="font-label-numeric text-[20px] font-bold text-on-surface">
                    $349
                  </span>
                  <span className="font-label-numeric text-body-sm text-outline line-through">
                    $460
                  </span>
                </div>
              </div>

              {/* Golden Claim Button */}
              <button
                onClick={() =>
                  addToCart({
                    id: 'aura-pro-studio',
                    name: 'Aura Pro Studio Wireless Headphones',
                    sku: 'AUR-PRO-01G',
                    price: 349,
                    originalPrice: 460,
                    image:
                      'https://lh3.googleusercontent.com/aida-public/AB6AXuAQ1MxMa7OdGkI_NRFfGRpESwB8ySKrS8b0AweaQWbaTRRwxkDsbLMelAGU4RDTb8jJ2NSd8ql91XgMCoby6VIaBYyp81-NVbwIIDgB3rATWlzo0GPC1nZLWPkaPRYnSP7We30l7shmI6Jx-sSKKSgJfSDXZpZCpmwZeggYJIssZBDerscxTmpi0T7CzyLF6vRes0ytJ_QKivzd-IZNLW-8a36bqP7L5Y1KSXriwCgKATqUiFfaVAZ6Lw',
                    material: 'Titanium Gold',
                  })
                }
                className="px-4 py-2 bg-on-surface text-surface-container-lowest rounded-lg border border-primary-container/60 font-label-caps text-[11px] font-semibold tracking-wider flex items-center space-x-1.5 gold-glow-interactive active:scale-95 transition-all hover:bg-primary"
                type="button"
              >
                <span>{tCommon('claimOffer')}</span>
                <span className="material-symbols-outlined text-[15px] text-primary-fixed-dim">
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        </article>

        {/* Side-Peek Card 1: Titanium Watch Ultra */}
        <article className="min-w-[80vw] sm:min-w-[340px] max-w-[80vw] sm:max-w-[360px] flex-shrink-0 snap-center rounded-xl bg-surface-container-lowest border border-outline-variant/40 p-4 flex flex-col justify-between opacity-95 hover:border-primary-container/60 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2 py-0.5 bg-surface-container border border-outline-variant rounded font-label-caps text-[10px] text-secondary">
                {t('limitedDrop')}
              </span>
              <span className="font-label-numeric text-[11px] text-primary font-semibold">
                $799
              </span>
            </div>
            <div className="w-full h-44 rounded-lg bg-surface-container-low overflow-hidden relative mb-3 border border-outline-variant/20 flex items-center justify-center">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9vuVvikSErCncwzMalAYoBWHq42QDuTtQF8xl_oLvtf5G5qPs294VV-wN16I_e4yspb5hiUKtQNp5pJ1crRKAhHkq9Kw6eIRmuU3ePcSVrNpA3wPaFvG9vlXyfWIF1BAzpnfzmyHs8YekjlHY4Gp1RhSmcN_5-N4s3NR1fXkVYTGsJ_kN9W5oYLJcMfPdkkQpIm7WNrouLPjCJbK5AplXV-Fmug8_0auujLzzeSpq9oZZ7pR0J1H_RA"
                alt="Titanium Watch Ultra"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
            <p className="font-label-caps text-label-caps text-primary tracking-widest">
              Horology Tech
            </p>
            <h3 className="font-headline-sm text-title-md text-on-surface font-semibold">
              {t('watchTitle')}
            </h3>
          </div>

          <div className="mt-4 pt-3 border-t border-outline-variant/30 flex items-center justify-between">
            <span className="font-label-caps text-[11px] text-on-surface-variant">
              {t('watchDesc')}
            </span>
            <button
              onClick={() =>
                addToCart({
                  id: 'titanium-watch-ultra',
                  name: 'Titanium Watch Ultra',
                  sku: 'AUR-WTC-02T',
                  price: 799,
                  originalPrice: 899,
                  image:
                    'https://lh3.googleusercontent.com/aida-public/AB6AXuC9vuVvikSErCncwzMalAYoBWHq42QDuTtQF8xl_oLvtf5G5qPs294VV-wN16I_e4yspb5hiUKtQNp5pJ1crRKAhHkq9Kw6eIRmuU3ePcSVrNpA3wPaFvG9vlXyfWIF1BAzpnfzmyHs8YekjlHY4Gp1RhSmcN_5-N4s3NR1fXkVYTGsJ_kN9W5oYLJcMfPdkkQpIm7WNrouLPjCJbK5AplXV-Fmug8_0auujLzzeSpq9oZZ7pR0J1H_RA',
                  material: 'Grade 5 Titanium',
                })
              }
              className="p-2 border border-outline-variant/60 rounded-lg text-primary hover:bg-surface-container-low active:scale-95 transition-all"
              type="button"
              aria-label="Add Titanium Watch Ultra to bag"
            >
              <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
            </button>
          </div>
        </article>

        {/* Side-Peek Card 2: MagCharge Desk Dock */}
        <article className="min-w-[80vw] sm:min-w-[340px] max-w-[80vw] sm:max-w-[360px] flex-shrink-0 snap-center rounded-xl bg-surface-container-lowest border border-outline-variant/40 p-4 flex flex-col justify-between opacity-95 hover:border-primary-container/60 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2 py-0.5 bg-surface-container border border-outline-variant rounded font-label-caps text-[10px] text-secondary">
                {t('deskSystem')}
              </span>
              <span className="font-label-numeric text-[11px] text-primary font-semibold">
                $189
              </span>
            </div>
            <div className="w-full h-44 rounded-lg bg-surface-container-low overflow-hidden relative mb-3 border border-outline-variant/20 flex items-center justify-center">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDf8wenLcUC_lhe9wM4XRnQHj_RJaOEIlKPNOFAqwVDadsWHgf-G0K1cf8v_txxm_14MAPWLjSyacLYAEoP8w5sNuBzqLKWFThw_CAQorkGr91a24qUh8WBnaux-H61HZbUOYqMuNyjc49E-2jjwYp-58ycartw1QIz_WengtZGCsuchZTMLMudT_O4xLeWEh9rk1FQsp6awGZoPYFtjVBzfAqSByBqD9Lfiw7t6l_TiV5ugNK0lTAzJg"
                alt="MagCharge Desk Dock"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
            <p className="font-label-caps text-label-caps text-primary tracking-widest">
              Power Engineering
            </p>
            <h3 className="font-headline-sm text-title-md text-on-surface font-semibold">
              {t('dockTitle')}
            </h3>
          </div>

          <div className="mt-4 pt-3 border-t border-outline-variant/30 flex items-center justify-between">
            <span className="font-label-caps text-[11px] text-on-surface-variant">
              {t('dockDesc')}
            </span>
            <button
              onClick={() =>
                addToCart({
                  id: 'magcharge-desk-dock',
                  name: 'MagCharge Desk Dock',
                  sku: 'AUR-DCK-03M',
                  price: 189,
                  image:
                    'https://lh3.googleusercontent.com/aida-public/AB6AXuDf8wenLcUC_lhe9wM4XRnQHj_RJaOEIlKPNOFAqwVDadsWHgf-G0K1cf8v_txxm_14MAPWLjSyacLYAEoP8w5sNuBzqLKWFThw_CAQorkGr91a24qUh8WBnaux-H61HZbUOYqMuNyjc49E-2jjwYp-58ycartw1QIz_WengtZGCsuchZTMLMudT_O4xLeWEh9rk1FQsp6awGZoPYFtjVBzfAqSByBqD9Lfiw7t6l_TiV5ugNK0lTAzJg',
                  material: 'Champagne Aluminum',
                })
              }
              className="p-2 border border-outline-variant/60 rounded-lg text-primary hover:bg-surface-container-low active:scale-95 transition-all"
              type="button"
              aria-label="Add MagCharge Desk Dock to bag"
            >
              <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
