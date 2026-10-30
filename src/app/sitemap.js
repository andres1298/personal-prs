import { siteUrl } from '../lib/site';

export default function sitemap() {
  return [
    { url: siteUrl(), lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: `${siteUrl()}/register`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
  ];
}
