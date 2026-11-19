import { Archivo } from 'next/font/google';
import { SHELL_SCRIPT } from '../lib/shell';
import { SITE_DESCRIPTION, SITE_IMAGE, SITE_NAME, siteUrl } from '../lib/site';
import './globals.css';

// Variable width and weight: the display style uses the expanded width (125%) at weight 900.
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], display: 'swap', variable: '--font-archivo' });

export const metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'PRs',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  openGraph: { siteName: SITE_NAME, locale: 'es_LA', type: 'website', images: [SITE_IMAGE] },
  twitter: { card: 'summary_large_image', images: [SITE_IMAGE] },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f1ec' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0d' },
  ],
};

export default function RootLayout({ children }) {
  // The script marks which skeleton the loading screen shows before anything paints (see lib/shell).
  return <html lang="es" className={archivo.variable} suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: SHELL_SCRIPT }} /></head>
    <body>{children}</body>
  </html>;
}
