import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB, webDB } from '@/lib/db';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'admin-ban', 20, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actor = session.user.id;
    const body = await request.json().catch(() => ({}));
    const account = (body.account || '').trim();
    const action = (body.action || '').toLowerCase(); // 'ban' | 'unban'
    const reason = (body.reason || '').trim();
    const ip = (request.headers.get('x-forwarded-for') || '')
      .split(',')[0]
      .trim() || request.headers.get('x-real-ip') || '127.0.0.1';

    if (!account || (action !== 'ban' && action !== 'unban')) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Require reason 5..200 chars
    if (!reason || reason.length < 5 || reason.length > 200) {
      return NextResponse.json({ error: 'Reason must be 5-200 characters' }, { status: 400 });
    }

    // Permission: GameMasterType=1 and GameMasterLevel >= 3 (Admin or higher)
    const adminCheck = await userDB.query(
      `SELECT ISNULL(GameMasterType,0) as GameMasterType, ISNULL(GameMasterLevel,0) as GameMasterLevel
       FROM UserInfo WHERE AccountName = @actor`,
      { actor }
    );
    if (!adminCheck.recordset?.length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const gm = adminCheck.recordset[0];
    if (!(gm.GameMasterType === 1 && gm.GameMasterLevel >= 3)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const banValue = action === 'ban' ? 1 : 0;

    // Update ban status
    await userDB.query(
      `UPDATE UserInfo SET BanStatus = @ban WHERE AccountName = @account;`,
      { account, ban: banValue }
    );

    // Audit log
    await webDB.query(
      `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
       VALUES (@actor, 'ADMIN_BAN', @details, @ip)`,
      {
        actor,
        details: `target=${account}; action=${action}; reason=${reason}`,
        ip,
      }
    );

    return NextResponse.json({ ok: true, BanStatus: banValue });
  } catch (error) {
    console.error('Admin ban error:', error);
    return NextResponse.json(
      { error: 'Ban update failed' },
      { status: 500 }
    );
  }
}
