'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        aria-label="Toggle Night Mode"
        className={`p-1.5 text-on-surface-variant hover:text-primary transition-colors active:scale-95 rounded ${className}`}
        type="button"
      >
        <span className="material-symbols-outlined text-[20px]">light_mode</span>
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      aria-label="Toggle Night Mode"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`p-1.5 text-on-surface-variant hover:text-primary transition-all duration-200 active:scale-95 rounded hover:bg-surface-container-low ${className}`}
      type="button"
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <span className="material-symbols-outlined text-[20px]">
        {isDark ? 'dark_mode' : 'light_mode'}
      </span>
    </button>
  );
}
