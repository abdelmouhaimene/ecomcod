import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['en', 'fr', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async () => {
  let locale: Locale = defaultLocale;
  try {
    const cookieStore = await cookies();
    const rawLocale = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined;
    if (rawLocale && locales.includes(rawLocale)) {
      locale = rawLocale;
    }
  } catch {
    // In build or static generation, cookies() might not be available
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
