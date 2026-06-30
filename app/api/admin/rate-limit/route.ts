import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { rateLimiter, recentBlocks } from '@/lib/rate-limit';

async function checkAdmin() {
  const session = await auth();
  return (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin === true;
}

export async function GET() {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    entries: rateLimiter.getAll(),
    recentBlocks: recentBlocks.slice(0, 100),
  });
}

export async function DELETE(request: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const filter = request.nextUrl.searchParams.get('filter') || undefined;
  const flushed = rateLimiter.flush(filter);
  return NextResponse.json({ flushed });
}
