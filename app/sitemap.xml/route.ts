import { NextResponse } from 'next/server';

// Simple XML sitemap for public pages and dynamic CMS pages.
export async function GET() {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://taleofasia.com';
    const cleanBase = base.replace(/\/$/, '');

    // Static known routes
    const staticUrls: { path: string; priority: string; lastmod?: string }[] = [
      { path: '/', priority: '1.0' },
      { path: '/downloads', priority: '0.9' },
      { path: '/register', priority: '0.8' },
      { path: '/rankings', priority: '0.8' },
      { path: '/mix-list', priority: '0.7' },
      { path: '/info/getting-started', priority: '0.7' },
      { path: '/info/server-rules', priority: '0.6' },
      { path: '/info/about', priority: '0.6' },
    ];

    // Dynamic CMS via /p/[slug] — fetch up to 50 recent slugs
    let dynamic: { path: string; priority: string }[] = [];
    try {
      const r = await fetch(`${cleanBase}/api/public/pages/list`, { cache: 'no-store' });
      const j = await r.json();
      if (Array.isArray(j.items)) {
        dynamic = j.items.map((it: any) => ({ path: `/p/${encodeURIComponent(String(it.Slug))}`, priority: '0.6' }));
      }
    } catch {}

    const urls = [...staticUrls, ...dynamic];

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map((u) => `  <url><loc>${cleanBase}${u.path}</loc><priority>${u.priority}</priority></url>`),
      '</urlset>',
    ].join('\n');

    return new NextResponse(xml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  } catch {
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>', {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  }
}
