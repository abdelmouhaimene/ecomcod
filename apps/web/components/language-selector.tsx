'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

const languages = [
  { code: 'en', label: 'EN', name: 'English', dir: 'ltr' },
  { code: 'fr', label: 'FR', name: 'Français', dir: 'ltr' },
  { code: 'ar', label: 'AR', name: 'العربية', dir: 'rtl' },
] as const;

export function LanguageSelector({ currentLocale = 'en' }: { currentLocale?: string }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const router = useRouter();
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const activeLang = languages.find((l) => l.code === currentLocale) || languages[0];

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLanguage = (code: string) => {
    // Set cookie for 1 year
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000; SameSite=Lax`;
    setIsOpen(false);
    router.refresh();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 px-1.5 py-1 rounded border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant transition-colors hover:border-primary-container active:scale-95"
        type="button"
        aria-label="Select Language"
      >
        <span className="material-symbols-outlined text-[15px] text-primary">public</span>
        <span className="font-label-caps text-[10px] tracking-wider text-on-surface font-semibold">
          {activeLang.label}
        </span>
        <span className="material-symbols-outlined text-[14px] text-outline">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-32 bg-surface-container-lowest border border-outline-variant/50 rounded-lg shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                lang.code === currentLocale
                  ? 'bg-primary-container/15 text-primary font-bold'
                  : 'text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <span>{lang.name}</span>
              <span className="font-label-caps text-[10px] opacity-70 uppercase">{lang.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
