import { siteUrl } from '../lib/site';

// The API and account flows are not crawled. The app at /app is crawlable but asks not to be indexed.
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/auth/', '/invite/'] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
