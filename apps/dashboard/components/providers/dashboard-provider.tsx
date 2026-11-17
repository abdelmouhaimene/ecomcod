'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import type { ReactNode } from 'react';
import {
    DEFAULT_LOCALE,
    documentDirection,
    isLocale,
    translate,
    type Locale,
    type TranslationKey,
} from '../../lib/i18n';

export type Theme = 'light' | 'dark';

interface DashboardContextValue {
    theme: Theme;
    locale: Locale;
    direction: 'ltr' | 'rtl';
    toggleTheme: () => void;
    setLocale: (locale: Locale) => void;
    t: (key: TranslationKey) => string;
}

const THEME_KEY = 'dashboard-theme';
const LOCALE_KEY = 'dashboard-locale';

const DashboardContext = createContext<DashboardContextValue | null>(null);

function readTheme(): Theme {
    try {
        const saved = window.localStorage.getItem(THEME_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch {
        // Storage can be unavailable in private browsing; fall back to the OS.
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readLocale(): Locale {
    try {
        const saved = window.localStorage.getItem(LOCALE_KEY);
        if (isLocale(saved)) return saved;
    } catch {
        // Storage can be unavailable in private browsing; use the default.
    }

    return DEFAULT_LOCALE;
}

function applyPreferences(theme: Theme, locale: Locale): void {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.lang = locale;
    root.dir = documentDirection(locale);
}

export function DashboardProvider({ children }: { children: ReactNode }): React.JSX.Element {
    const [theme, setTheme] = useState<Theme>('light');
    const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

    // The pre-paint script in the root layout already set the attributes.
    // Restore state from the same storage keys without flashing defaults.
    useEffect(() => {
        const initialTheme = readTheme();
        const initialLocale = readLocale();
        applyPreferences(initialTheme, initialLocale);
        setTheme(initialTheme);
        setLocaleState(initialLocale);
    }, []);

    const toggleTheme = useCallback(() => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        applyPreferences(next, locale);
        try {
            window.localStorage.setItem(THEME_KEY, next);
        } catch {
            // Theme still applies for this page view.
        }
    }, [theme, locale]);

    const setLocale = useCallback((next: Locale) => {
        setLocaleState(next);
        applyPreferences(theme, next);
        try {
            window.localStorage.setItem(LOCALE_KEY, next);
        } catch {
            // Locale still applies for this page view.
        }
    }, [theme]);

    const t = useCallback((key: TranslationKey) => translate(locale, key), [locale]);

    const value = useMemo<DashboardContextValue>(() => ({
        theme,
        locale,
        direction: documentDirection(locale),
        toggleTheme,
        setLocale,
        t,
    }), [theme, locale, toggleTheme, setLocale, t]);

    return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
    const context = useContext(DashboardContext);
    if (!context) throw new Error('useDashboard must be used inside DashboardProvider');
    return context;
}
