import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from '../components/theme-provider';
import { StoreProvider } from '../context/store-context';
import { AuthProvider } from '../context/auth-context';
import { StoreInfoProvider } from '../context/store-info-context';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { BottomNav } from '../components/layout/bottom-nav';
import { catalogApi } from '../lib/api';
import { resolveMediaUrl } from '../lib/catalog';
import './globals.css';

const plusJakartaSans = localFont({
  src: './fonts/PlusJakartaSans-Variable.woff2',
  weight: '200 800',
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const spaceGrotesk = localFont({
  src: './fonts/SpaceGrotesk-Variable.woff2',
  weight: '300 700',
  variable: '--font-space-grotesk',
  display: 'swap',
});

const materialSymbols = localFont({
  src: './fonts/MaterialSymbolsOutlined-Variable.woff2',
  weight: '100 700',
  variable: '--font-material-symbols',
  display: 'swap',
});

const FALLBACK_TITLE = 'AURELIA TECH | High-End Precision Hardware & Tech Accessories';
const FALLBACK_DESCRIPTION =
  'Architectural precision hardware and high-grade physical accoutrements crafted for discerning computational environments.';
const FALLBACK_ICON = '/favicon.ico';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const store = await catalogApi.getStore();
    return {
      title: store.name || FALLBACK_TITLE,
      description: store.description || FALLBACK_DESCRIPTION,
      icons: { icon: resolveMediaUrl(store.logo) || FALLBACK_ICON },
    };
  } catch {
    return {
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
      icons: { icon: FALLBACK_ICON },
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const isRtl = locale === 'ar';

  return (
    <html
      lang={locale}
      dir={isRtl ? 'rtl' : 'ltr'}
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${spaceGrotesk.variable} ${materialSymbols.variable}`}
    >
      <body
        className="font-body-md text-body-md bg-background text-on-surface antialiased selection:bg-primary-container selection:text-surface-container-lowest transition-colors duration-200 min-h-screen flex flex-col"
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange={false}
          >
            <StoreProvider>
              <AuthProvider>
                <StoreInfoProvider>
                  <Header currentLocale={locale} />
                  <div className="flex-1">{children}</div>
                  <Footer />
                  <BottomNav />
                </StoreInfoProvider>
              </AuthProvider>
            </StoreProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
