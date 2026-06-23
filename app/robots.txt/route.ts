import { NextResponse } from 'next/server';

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://taleofasia.com';
  const cleanBase = base.replace(/\/$/, '');

  const txt = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/admin',
    'Disallow: /dashboard',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /forgot-password',
    'Disallow: /reset-password',
    'Disallow: /verify-email',
    'Disallow: /resend-verification',
    'Disallow: /payment/return',
    'Disallow: /test-wallet',
    '',
    `Sitemap: ${cleanBase}/sitemap.xml`,
    '',
    `Host: ${cleanBase.replace(/^https?:\/\//, '')}`,
  ].join('\n');

  return new NextResponse(txt, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
