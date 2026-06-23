import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'user-payments', 30, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const timezone = searchParams.get('timezone') || '';

    let query = `
      SELECT TransactionID, Amount, Currency, UsdAmount, LocalCurrency, LocalAmount,
             PaymentMethod, Status, GatewayTransactionID, CoinsAwarded, BonusRate,
             ExpiresAt, Notes, CreatedAt, CompletedAt
      FROM PaymentTransactions
      WHERE AccountName = @username
    `;
    if (statusFilter && statusFilter !== 'all') {
      query += ` AND Status = @statusFilter`;
    }
    query += ` ORDER BY CreatedAt DESC`;

    const result = await webDB.query(query, { username, statusFilter: statusFilter || undefined });
    const rows = (result.recordset || []).map((r: any) => {
      let createdAtLocal = '';
      let completedAtLocal = '';
      try {
        const tz = timezone || 'UTC';
        if (r.CreatedAt) createdAtLocal = new Date(r.CreatedAt).toLocaleString('en-US', { timeZone: tz });
        if (r.CompletedAt) completedAtLocal = new Date(r.CompletedAt).toLocaleString('en-US', { timeZone: tz });
      } catch {}
      return { ...r, CreatedAtLocal: createdAtLocal, CompletedAtLocal: completedAtLocal };
    });
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching user payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
