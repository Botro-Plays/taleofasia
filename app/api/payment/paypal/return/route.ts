import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const redirectTarget = url.searchParams.get('redirect') || '/dashboard/topup?payment=success&method=PayPal';
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://taleofasia.com';

  // If the redirect target is the old direct topup link, route through the
  // intermediate payment return page that shows a countdown + "Return to Merchant" button
  if (redirectTarget.startsWith('/dashboard/topup?payment=success')) {
    const params = new URLSearchParams(redirectTarget.split('?')[1] || '');
    const method = params.get('method') || 'PayPal';
    return NextResponse.redirect(
      `${siteOrigin}/payment/return?status=success&method=${encodeURIComponent(method)}`,
      { status: 302 }
    );
  }

  return NextResponse.redirect(`${siteOrigin}${redirectTarget}`, { status: 302 });
}
