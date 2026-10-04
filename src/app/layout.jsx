import './globals.css';

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
    statusBarStyle: 'black-translucent',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0e0e0f',
};

export default function RootLayout({ children }) {
  return <html lang="es"><body>{children}</body></html>;
}
