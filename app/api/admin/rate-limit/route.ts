import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { rateLimiter, recentBlocks } from '@/lib/rate-limit';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.name) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const priv = await checkAdminPrivileges(session.user.name);
    if (!priv.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({
      entries: rateLimiter.getAll(),
      recentBlocks: recentBlocks.slice(0, 100),
    });
  } catch (err) {
    console.error('[rate-limit GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.name) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const priv = await checkAdminPrivileges(session.user.name);
    if (!priv.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const filter = request.nextUrl.searchParams.get('filter') || undefined;
    const flushed = rateLimiter.flush(filter);
    return NextResponse.json({ flushed });
  } catch (err) {
    console.error('[rate-limit DELETE]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
