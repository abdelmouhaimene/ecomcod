import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { DashboardProvider } from '../components/providers/dashboard-provider';
import { AuthProvider } from '../components/providers/auth-provider';

const geistSans = localFont({
    src: './fonts/GeistVF.woff',
    variable: '--font-geist-sans',
    display: 'swap',
});
const geistMono = localFont({
    src: './fonts/GeistMonoVF.woff',
    variable: '--font-geist-mono',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Ecomcod Dashboard',
    description: 'Administration workspace for Ecomcod',
};

/** Applies saved preferences before first paint so dark mode and RTL do not flash. */
const initialPreferences = `(function(){try{var t=localStorage.getItem('dashboard-theme');var l=localStorage.getItem('dashboard-locale');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(l!=='en'&&l!=='fr'&&l!=='ar'){l='en';}var r=document.documentElement;r.dataset.theme=t;r.lang=l;r.dir=l==='ar'?'rtl':'ltr';}catch(e){}})();`;

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" dir="ltr" suppressHydrationWarning>
            <head>
                <meta name="color-scheme" content="light dark" />
                <script dangerouslySetInnerHTML={{ __html: initialPreferences }} />
            </head>
            <body className={`${geistSans.variable} ${geistMono.variable}`}>
                <DashboardProvider>
                    <AuthProvider>{children}</AuthProvider>
                </DashboardProvider>
            </body>
        </html>
    );
}
