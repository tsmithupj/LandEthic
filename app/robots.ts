import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://landethic.io';

// Let search engines see the public pages, not members' dashboards or the API.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/onboarding', '/upgrade', '/api/'] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
