import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB } from '@/lib/db';
import { logApi, logError } from '@/lib/logging';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'user-change-password', 5, 15 * 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const session = await auth();
    const username = session?.user?.name as string | undefined;
    if (!username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const currentPassword = body?.currentPassword as string | undefined;
    const newPassword = body?.newPassword as string | undefined;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 8 || newPassword.length > 20) {
      return NextResponse.json({ error: 'New password must be between 8 and 20 characters long' }, { status: 400 });
    }

    // Fetch current stored password (plain text to match legacy behavior)
    const result = await userDB.query<{ Password: string }>(
      'SELECT Password FROM UserInfo WHERE AccountName = @username',
      { username }
    );

    if (!result.recordset || result.recordset.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const stored = result.recordset[0].Password;
    if (stored !== currentPassword) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    // Update password (kept as-is for compatibility with existing system)
    await userDB.query(
      'UPDATE UserInfo SET Password = @newPassword WHERE AccountName = @username',
      { newPassword, username }
    );

    // Log the change
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await logApi({ action: 'PASSWORD_CHANGE', account: username, details: 'User changed password', ip });

    return NextResponse.json({ message: 'Password changed successfully' }, { status: 200 });
  } catch (error) {
    await logError({ where: 'user/change-password', error, account: undefined, ip: '127.0.0.1' });
    return NextResponse.json({ error: 'An error occurred while changing password' }, { status: 500 });
  }
}
