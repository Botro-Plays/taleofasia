import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB } from '@/lib/db';
import { cached } from '@/lib/cache';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'user-time-points', 30, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const username = session.user.id;

    const { points } = await cached(`time-points:${username}`, 15_000, async () => {
      // Try fetching a single row; schema may vary across deployments
      const result = await userDB.query(`
        SELECT TOP 1 *
        FROM UserTimeCoin
        WHERE AccountName = @username
      `, { username });

      let points = 0;
      if (result.recordset && result.recordset.length > 0) {
        const row: Record<string, any> = result.recordset[0];
        const candidates = ['TimePoint', 'TimePoints', 'Points', 'Coin', 'Coins', 'TimeCoin'];
        for (const key of candidates) {
          if (Object.prototype.hasOwnProperty.call(row, key) && typeof (row as any)[key] === 'number') {
            points = (row as any)[key];
            break;
          }
        }
        if (points === 0) {
          // Fallback: first numeric column value
          for (const [, v] of Object.entries(row)) {
            if (typeof v === 'number') { points = v; break; }
          }
        }
      }
      return { points };
    });

    return NextResponse.json(
      { points },
      { headers: { 'Cache-Control': 'private, max-age=15' } }
    );
  } catch (error) {
    console.error('Error fetching time points:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time points' },
      { status: 500 }
    );
  }
}
