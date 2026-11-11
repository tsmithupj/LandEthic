import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://landethic.io';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
