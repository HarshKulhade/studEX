import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import DesktopWarning from '@/components/DesktopWarning';

export const metadata: Metadata = {
  title: 'StudEX — The Student Broadsheet',
  description: 'Hyperlocal deals, cashback, print & career opportunities for college students.',
  openGraph: {
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'StudEX — The Student Broadsheet',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'StudEX',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/apple-icon.png',
  },
  themeColor: '#e8a020',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Grain overlay for paper tactility */}
        <div className="grain-overlay" aria-hidden="true" />
        <DesktopWarning />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
