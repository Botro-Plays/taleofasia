import { NextRequest, NextResponse } from 'next/server';
import { gameDB } from '@/lib/db';
import { cached } from '@/lib/cache';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'public-mix-list', 60, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const data = await cached('public:mix-list', 60_000, async () => {
      const res = await gameDB.query<any>(
        `SELECT * FROM MixList WHERE TypeMix != 10 AND NewSheltom14 = 0 AND NewSheltom15 = 0 ORDER BY TypeMix ASC, ID ASC`
      );
      const items = res.recordset || [];
      return { items };
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error('Public mix-list error:', e);
    return NextResponse.json({ items: [] });
  }
}
