import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { serverDB, userDB, webDB } from '@/lib/db';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'admin-online-users', 30, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actor = session.user.id;

    // Verify admin privileges
    const adminCheck = await userDB.query(
      `SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @actor`,
      { actor }
    );

    if (!adminCheck.recordset.length) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const gm = adminCheck.recordset[0];
    if (!(gm.GameMasterType === 1 && gm.GameMasterLevel >= 3)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Query 1: Unique IPs
    const countResult = await serverDB.query(
      `SELECT COUNT(DISTINCT IP) AS UniqueIPCount FROM UsersOnline`
    );
    const uniqueIPCount = countResult.recordset[0]?.UniqueIPCount || 0;

    // Query 2: Online users
    const usersResult = await serverDB.query(
      `SELECT AccountName, CharacterName, IP, CharacterClass, CharacterLevel, Ticket, LoginTime
       FROM UsersOnline
       ORDER BY LoginTime ASC`
    );

    // Audit log
    await webDB.query(
      `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
       VALUES (@actor, 'ADMIN_ONLINE_USERS', 'Viewed online users', @ip)`,
      { actor, ip }
    );

    return NextResponse.json({
      unique_ip_count: uniqueIPCount,
      users: usersResult.recordset || [],
    });
  } catch (error) {
    console.error('Admin online users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch online users' },
      { status: 500 }
    );
  }
}
