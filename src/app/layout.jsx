import { Archivo } from 'next/font/google';
import './globals.css';

// Variable width and weight: the display style uses the expanded width (125%) at weight 900.
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], display: 'swap', variable: '--font-archivo' });

export const metadata = {
  title: 'Mis PRs',
  description: 'Registra tus marcas personales y calcula pesos para entrenar.',
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
  return <html lang="es" className={archivo.variable}><body>{children}</body></html>;
}
