import { NextRequest, NextResponse } from 'next/server';
import { userDB } from '@/lib/db';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'stats', 60, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const currentYear = new Date().getFullYear();
    const baseYear = 2024;
    const yearsLegacy = currentYear - baseYear;

    // Get active players count from UserInfo
    const result = await userDB.query(`
      SELECT COUNT(*) as count FROM UserInfo WHERE Flag = 98
    `);

    const activePlayers = result.recordset[0]?.count || 0;

    return NextResponse.json({
      yearsLegacy,
      activePlayers,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { yearsLegacy: 2, activePlayers: 0 },
      { status: 500 }
    );
  }
}
