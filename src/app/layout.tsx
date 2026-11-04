import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { clientEnv } from '@/lib/env';
import { siteConfig } from '@/lib/site-config';
import './globals.css';

/**
 * The two families in the design: Figtree for text, Barlow for titles. Nothing else.
 *
 * Both ship from `src/app/fonts` as WOFF2 and are served by `next/font` from our own
 * origin — no runtime request to a font CDN, which keeps `font-src 'self'` in the CSP
 * and avoids leaking visitor IPs to a third party.
 *
 * Figtree is one variable file, so every text weight costs the same single download.
 * Barlow has no variable cut, so only the four weights a heading actually uses are
 * shipped; ask for a weight outside 500–800 and the browser will synthesise it.
 *
 * Both are under the SIL Open Font License, which permits bundling them; the licence
 * text travels inside each file's `name` table.
 */
const figtree = localFont({
  src: './fonts/figtree-variable.woff2',
  weight: '300 900',
  display: 'swap',
  variable: '--font-figtree',
});

const barlow = localFont({
  src: [
    { path: './fonts/barlow-500.woff2', weight: '500' },
    { path: './fonts/barlow-600.woff2', weight: '600' },
    { path: './fonts/barlow-700.woff2', weight: '700' },
    { path: './fonts/barlow-800.woff2', weight: '800' },
  ],
  display: 'swap',
  variable: '--font-barlow',
  // Barlow has no ₹. Without a metric-matched Arial stand-in in its stack, a rupee
  // figure in a heading falls through to Figtree — still one of our two families —
  // rather than to Arial.
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: `${siteConfig.name} — Bank Auction Marketplace`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    title: `${siteConfig.name} — Bank Auction Marketplace`,
    description: siteConfig.description,
    locale: 'en_IN',
  },
  twitter: { card: 'summary_large_image' },
  robots: {
    index: true,
    follow: true,
    // Signed-in surfaces opt out individually; nothing here should reach a cache.
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: '#1570ef',
  width: 'device-width',
  initialScale: 1,
  // Never block zoom — pinch-zoom is an accessibility requirement, not a nuisance.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${figtree.variable} ${barlow.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-100 focus:rounded-btn focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>

        <SiteHeader />

        <main id="main">
          {children}
        </main>

        <SiteFooter />
      </body>
    </html>
  );
}
