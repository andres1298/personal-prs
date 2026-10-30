// Public identity of the site: name, copy shared by metadata and structured data, and the origin
// used for absolute URLs (canonical, Open Graph, sitemap). Server only reads SITE_URL.

export const SITE_NAME = 'Mis PRs';
export const SITE_TITLE = 'Mis PRs · Tus PRs de CrossFit y los discos de la barra';
export const SITE_DESCRIPTION =
  'Guarda tus marcas personales de CrossFit, calcula el peso por porcentaje y ve qué discos poner en la barra, con calentamiento y timer. Gratis, desde tu teléfono.';

// Shared preview for links on social networks and chats (1200×630, in public/).
export const SITE_IMAGE = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'Mis PRs: registra tus PRs de CrossFit y ve los discos de la barra al porcentaje exacto.',
};

// Same order as the confirmation links: explicit SITE_URL, Vercel's production domain, then local development.
export function siteUrl() {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return new URL(configured).origin;
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return production ? `https://${production}` : 'http://localhost:3000';
}
