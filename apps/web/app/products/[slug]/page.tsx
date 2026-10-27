'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useStore } from '../../../context/store-context';

const galleryImages = [
  {
    id: 1,
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAQ1MxMa7OdGkI_NRFfGRpESwB8ySKrS8b0AweaQWbaTRRwxkDsbLMelAGU4RDTb8jJ2NSd8ql91XgMCoby6VIaBYyp81-NVbwIIDgB3rATWlzo0GPC1nZLWPkaPRYnSP7We30l7shmI6Jx-sSKKSgJfSDXZpZCpmwZeggYJIssZBDerscxTmpi0T7CzyLF6vRes0ytJ_QKivzd-IZNLW-8a36bqP7L5Y1KSXriwCgKATqUiFfaVAZ6Lw',
    alt: 'Flagship Aura Pro Studio in Champagne Gold',
  },
  {
    id: 2,
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBLnjr1FErd05ZXE5YOyVs0G3IASeB9cQl7uS1Vfvu7vMz0wvTqO1IMN9wjd0bfeNeaxX2HVBp1csvNEseNgyLrwjKaMqPRu5P-_5r5ge6cs8PguV6PbdCRcgMQMv1GILjfZwcZxo9vX8WqeepXBLrdH56ORQxYBnMFMGRFOK3i9EAvh_XZSrCOcUDL2FJ8NQA8rrJl-ol4njotkK-XFkVolaYZ8iU2KaL7girZuOWM1ckif3vlMTWllw',
    alt: 'Front profile view in studio light',
  },
  {
    id: 3,
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAtKGZjT8wCaAbZVbkNXvOZI6j2sQsT7kROW8cubMJMR3QtUkmJjkfhVu3gk9dZMChTU5CJpgNjALxa5Zzs9KIVaI42u7UFXyjdIVYd-0YUOYvTOTYqtGVQXJUy2iGrnYF1u8iytHpGHXEAAVzXWU3PMj895poQAc9P1amuROlTDOTl059umO0unfNHmTlcSpmO--y5OOeXDhtxy5Q7IPaC2r4xoxr4R08kKf812YRBVb70i0j1uJ-L0w',
    alt: 'Aerospace titanium adjustment hinge and rotary dial',
  },
  {
    id: 4,
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBdipR0ND1ENvim1xzfzr0q4ycHBzH9IoggubQpcZoFr3T8Bhwhtm0aBVe9KRm2zoZqWdYkIS2dJFKNMa4Swk6C-a0EiREC0EIscquDxPPeq14Q6aen4luGjV27EsiET5z58M0m5M9QD7AMPlrhW31p_FT6fSv-99vddkpGx2CR34IFEEeF3XRLZvDAoyuyRtgyooNqHQSsIz_F45_RnF4Y2Zsj1s00DjkQDG1nGxIH6uDRbVQ6OCoKcw',
    alt: 'Memory foam ear cushions in ivory leather',
  },
  {
    id: 5,
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAVDfTycB1NtLGchDflbWyzbRrYwgaxsj_UOx2EBcJ7rr3EX-p-gp-t1MIODpIS1nvYt_X8aTfjVmF2eiUvpfnT2BM50wJqObhmifDJMUYEp8iSilk2BJaKaMSY4XPNnY2KlHOjV5tI4qhnO0xxRoIVjPejRTWF3IULYviCNo4dxM8eP6bHysrui93sFU5mygaA9YqDNtv1F_E7dXnaK4YfnSgusnjD1s_NjLYtVKcmda27zxNRiSl1gQ',
    alt: 'Folded compact layout with tailored sculpted travel case',
  },
];

export default function ProductDetailsPage() {
  const t = useTranslations('product');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { addToCart, isWishlisted, toggleWishlist } = useStore();

  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [selectedMaterial, setSelectedMaterial] = React.useState('gold');
  const [addedToast, setAddedToast] = React.useState(false);

  const productId = 'aura-pro-studio';
  const wishlisted = isWishlisted(productId);

  const materials = [
    { id: 'gold', name: t('materials.gold'), color: 'bg-[#C5A059]' },
    { id: 'slate', name: t('materials.slate'), color: 'bg-[#1E293B]' },
    { id: 'ivory', name: t('materials.ivory'), color: 'bg-[#FDFBF7] border border-outline-variant' },
  ];

  const handleAddToBag = () => {
    addToCart({
      id: productId,
      name: 'Aura Pro Studio Wireless Headphones',
      sku: 'AUR-PRO-01G',
      price: 349,
      originalPrice: 460,
      image: galleryImages[0]?.src ?? '',
      material: materials.find((m) => m.id === selectedMaterial)?.name || 'Titanium Gold',
    });
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2500);
  };

  const handleDirectCheckout = () => {
    handleAddToBag();
    router.push('/checkout');
  };

  return (
    <div className="w-full min-h-screen bg-background text-on-surface antialiased pb-32">
      {/* Toast Notification */}
      {addedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-surface-container-lowest px-4 py-2.5 rounded-lg shadow-xl flex items-center space-x-2 border border-primary-container/40 animate-in fade-in slide-in-from-top-4 duration-200">
          <span
            className="material-symbols-outlined text-primary-container text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          <span className="font-label-caps text-[11px] tracking-wider font-semibold">
            {t('addedToBag')} ($349.00)
          </span>
        </div>
      )}

      {/* Breadcrumb / Top Bar */}
      <div className="max-w-md md:max-w-4xl mx-auto px-margin pt-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center space-x-1 text-on-surface-variant hover:text-primary transition-colors py-1 font-label-caps text-[11px]"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>{tCommon('back')}</span>
        </Link>
        <span className="font-label-caps text-[10px] text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded">
          SKU: AUR-PRO-01G
        </span>
      </div>

      <main className="max-w-md md:max-w-4xl mx-auto px-margin pt-2 space-y-6 md:grid md:grid-cols-2 md:gap-8 md:space-y-0">
        {/* 1. PRODUCT GALLERY */}
        <section aria-label="Product Gallery" className="space-y-3">
          {/* Main High-Fidelity Display Card */}
          <div className="relative bg-surface-container-lowest rounded-xl p-4 subtle-hairline gold-bloom overflow-hidden group">
            {/* Floating Badges */}
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-lowest gold-hairline text-on-surface font-label-caps text-label-caps shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
                {t('goldEdition')}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-caps text-label-caps">
                <span className="material-symbols-outlined text-[12px] text-primary">
                  graphic_eq
                </span>
                {t('lossless')}
              </span>
            </div>

            {/* Floating Utilities */}
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
              <button
                onClick={() => toggleWishlist(productId)}
                className={`w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur-md subtle-hairline flex items-center justify-center transition-all shadow-sm active:scale-90 ${
                  wishlisted
                    ? 'text-error'
                    : 'text-secondary hover:text-error'
                }`}
                aria-label="Wishlist"
                type="button"
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={wishlisted ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  favorite
                </span>
              </button>
            </div>

            {/* Hero Image */}
            <div className="w-full aspect-square flex items-center justify-center pt-4 pb-2">
              <img
                src={galleryImages[activeImageIndex]?.src ?? galleryImages[0]?.src}
                alt={galleryImages[activeImageIndex]?.alt ?? 'Product image'}
                className="w-full h-full object-contain filter drop-shadow-md transition-all duration-300 ease-out group-hover:scale-105"
              />
            </div>

            {/* Gallery Indicator Pills */}
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {galleryImages.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1 rounded-full transition-all duration-200 ${
                    idx === activeImageIndex ? 'w-6 bg-primary' : 'w-2 bg-outline-variant/40'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Multi-Angle Thumbnail Carousel */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {galleryImages.map((img, idx) => (
              <button
                key={img.id}
                onClick={() => setActiveImageIndex(idx)}
                className={`w-16 h-16 rounded-lg bg-surface-container-lowest p-1 flex-shrink-0 transition-all ${
                  idx === activeImageIndex
                    ? 'border-2 border-primary-container gold-bloom'
                    : 'subtle-hairline opacity-75 hover:opacity-100'
                }`}
                type="button"
              >
                <img src={img.src} alt={img.alt} className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        </section>

        {/* 2. PRODUCT INFO & PRICING */}
        <section aria-label="Product Information" className="space-y-4">
          <div className="space-y-1">
            <span className="font-label-caps text-label-caps text-primary tracking-widest uppercase font-bold">
              {t('flagshipBadge')}
            </span>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">
              Aura Pro Studio Headphones
            </h1>
            <p className="font-body-sm text-body-sm text-secondary">
              Bespoke Aerospace Aluminum & Champagne Gold Finish
            </p>
          </div>

          {/* Rating Display */}
          <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/30">
            <div className="flex items-center text-primary-container">
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  star
                </span>
              ))}
            </div>
            <span className="font-label-numeric text-label-numeric font-bold text-on-surface">
              4.9
            </span>
            <span className="font-body-sm text-body-sm text-secondary">
              (1,280 verified reviews)
            </span>
          </div>

          {/* Pricing Tier */}
          <div className="bg-surface-container-lowest p-4 rounded-xl subtle-hairline space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                $349.00
              </span>
              <span className="font-label-numeric text-label-numeric text-secondary line-through">
                $460.00
              </span>
              <span className="font-label-caps text-label-caps px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-bold">
                {t('save')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-secondary font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[16px] text-primary">payments</span>
              <span>{t('splitPayment')} </span>
              <strong className="font-label-numeric text-label-numeric text-on-surface font-bold">
                $87.25/mo
              </strong>
            </div>
          </div>

          {/* Luxury Hardware Material Selector */}
          <div className="space-y-2">
            <span className="font-label-caps text-[11px] text-on-surface uppercase tracking-wider block font-semibold">
              {t('selectMaterial')}
            </span>
            <div className="grid grid-cols-3 gap-2">
              {materials.map((mat) => {
                const isSelected = selectedMaterial === mat.id;
                return (
                  <button
                    key={mat.id}
                    onClick={() => setSelectedMaterial(mat.id)}
                    className={`p-2.5 rounded-lg text-left transition-all flex flex-col space-y-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-surface-container border-2 border-primary-container shadow-sm'
                        : 'bg-surface-container-lowest subtle-hairline hover:border-outline'
                    }`}
                    type="button"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`w-4 h-4 rounded-full ${mat.color}`} />
                      {isSelected && (
                        <span className="material-symbols-outlined text-primary text-[14px]">
                          check
                        </span>
                      )}
                    </div>
                    <span className="font-label-caps text-[10px] font-semibold text-on-surface truncate">
                      {mat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Specifications Accordion / Modules */}
          <div className="space-y-2 pt-2">
            <h3 className="font-label-caps text-[11px] text-primary uppercase tracking-widest font-bold">
              {t('specsTitle')}
            </h3>
            <div className="bg-surface-container-lowest rounded-xl subtle-hairline divide-y divide-outline-variant/20 text-xs">
              <div className="p-3 flex items-center justify-between">
                <span className="text-secondary">Acoustic Chambers</span>
                <span className="font-semibold text-on-surface">{t('specs.chambers')}</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-secondary">Transducers</span>
                <span className="font-semibold text-on-surface">{t('specs.driver')}</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-secondary">Battery Cell</span>
                <span className="font-semibold text-on-surface">{t('specs.battery')}</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-secondary">Processing DAC</span>
                <span className="font-semibold text-on-surface">{t('specs.dac')}</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Sticky Bottom Action Dock */}
      <aside className="fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 dark:bg-inverse-surface/95 backdrop-blur-md border-t border-outline-variant/30 py-3 px-margin shadow-2xl">
        <div className="max-w-md md:max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={handleAddToBag}
            className="flex-1 py-3 px-4 rounded-lg border border-primary-container text-on-surface hover:bg-surface-container-low font-label-caps text-[11px] font-bold tracking-wider flex items-center justify-center space-x-2 active:scale-95 transition-all"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">
              shopping_bag
            </span>
            <span>{tCommon('addToBag')} • $349</span>
          </button>

          <button
            onClick={handleDirectCheckout}
            className="flex-1 py-3 px-4 rounded-lg bg-on-surface text-surface-container-lowest border border-primary-container/60 font-label-caps text-[11px] font-bold tracking-wider flex items-center justify-center space-x-2 gold-glow-interactive active:scale-95 transition-all hover:bg-primary"
            type="button"
          >
            <span>{t('checkoutNow')}</span>
            <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">
              arrow_forward
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
}
