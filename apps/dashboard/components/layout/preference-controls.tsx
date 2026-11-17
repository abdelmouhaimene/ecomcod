'use client';

import { LOCALE_LABELS, LOCALES } from '../../lib/i18n';
import { useDashboard } from '../providers/dashboard-provider';

export function PreferenceControls(): React.JSX.Element {
    const { locale, setLocale, theme, toggleTheme, t } = useDashboard();

    return (
        <div className="preferences">
            <button
                type="button"
                className="theme-button"
                onClick={toggleTheme}
                aria-label={t('toggleTheme')}
                title={theme === 'dark' ? t('lightTheme') : t('darkTheme')}
            >
                <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
            </button>
            <label className="sr-only" htmlFor="dashboard-language">
                {t('language')}
            </label>
            <select
                id="dashboard-language"
                className="language-select"
                value={locale}
                onChange={(event) => setLocale(event.target.value as typeof locale)}
                aria-label={t('language')}
            >
                {LOCALES.map((option) => (
                    <option key={option} value={option}>
                        {LOCALE_LABELS[option]}
                    </option>
                ))}
            </select>
        </div>
    );
}
