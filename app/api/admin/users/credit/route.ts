import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB, webDB } from '@/lib/db';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'admin-credit', 20, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actor = session.user.id;
    const body = await request.json().catch(() => ({}));
    const account = (body.account || '').trim();
    const delta = Number(body.delta);
    const reasonRaw = (body.reason || '').trim();
    const reason = reasonRaw.slice(0, 200);
    const ip = (request.headers.get('x-forwarded-for') || '')
      .split(',')[0]
      .trim() || request.headers.get('x-real-ip') || '127.0.0.1';

    if (!account || !Number.isFinite(delta) || delta === 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    if (!reason || reason.length < 5) {
      return NextResponse.json({ error: 'Reason must be 5-200 characters' }, { status: 400 });
    }

    // Clamp to +/- 1,000,000 to prevent fat finger
    if (Math.abs(delta) > 1_000_000) {
      return NextResponse.json({ error: 'Delta too large' }, { status: 400 });
    }

    // Permission: SuperAdmin only (GameMasterType=1 and GameMasterLevel >= 3)
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

    // Perform update atomically
    const result = await userDB.query(
      `UPDATE UserInfo SET Coins = ISNULL(Coins,0) + @delta WHERE AccountName = @account;
       SELECT Coins FROM UserInfo WHERE AccountName = @account;`,
      { account, delta }
    );

    // Audit log
    await webDB.query(
      `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
       VALUES (@actor, 'ADMIN_CREDIT', @details, @ip)`,
      {
        actor,
        details: `target=${account}; delta=${delta}; reason=${reason || 'n/a'}`,
        ip,
      }
    );

    return NextResponse.json({ ok: true, balance: result.recordset?.[0]?.Coins ?? null });
  } catch (error) {
    console.error('Admin credit error:', error);
    return NextResponse.json(
      { error: 'Credit update failed' },
      { status: 500 }
    );
  }
}
