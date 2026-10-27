import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from '../components/theme-provider';
import { StoreProvider } from '../context/store-context';
import { Header } from '../components/layout/header';
import { BottomNav } from '../components/layout/bottom-nav';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AURELIA TECH | High-End Precision Hardware & Tech Accessories',
  description:
    'Architectural precision hardware and high-grade physical accoutrements crafted for discerning computational environments.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const isRtl = locale === 'ar';

  return (
    <html lang={locale} dir={isRtl ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body
        className={`${plusJakartaSans.variable} ${spaceGrotesk.variable} font-body-md text-body-md bg-background text-on-surface antialiased selection:bg-primary-container selection:text-surface-container-lowest transition-colors duration-200 min-h-screen flex flex-col`}
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange={false}
          >
            <StoreProvider>
              <Header currentLocale={locale} />
              <div className="flex-1 pb-16 md:pb-0">{children}</div>
              <BottomNav />
            </StoreProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
