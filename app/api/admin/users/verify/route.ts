import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB, webDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actor = session.user.id;
    const body = await request.json().catch(() => ({}));
    const account = (body.account || '').trim();
    const ip = (request.headers.get('x-forwarded-for') || '')
      .split(',')[0]
      .trim() || request.headers.get('x-real-ip') || '127.0.0.1';

    if (!account) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
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

    // Check current state
    const cur = await userDB.query(
      `SELECT TOP 1 ISNULL(Flag,0) as Flag, ISNULL(ActiveCode,0) as ActiveCode FROM UserInfo WHERE AccountName = @account`,
      { account }
    );
    if (!cur.recordset?.length) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    const beforeFlag = Number(cur.recordset[0].Flag || 0);
    if (beforeFlag !== 64) {
      return NextResponse.json({ error: 'Account is not pending verification' }, { status: 409 });
    }

    // Perform verification: set Flag=98 and ActiveCode=0, only when currently 64
    await userDB.query(
      `UPDATE UserInfo SET Flag = 98, ActiveCode = 0 WHERE AccountName = @account AND ISNULL(Flag,0) = 64`,
      { account }
    );

    const after = await userDB.query(
      `SELECT ISNULL(Flag,0) as Flag FROM UserInfo WHERE AccountName = @account`,
      { account }
    );
    const updatedFlag = Number(after.recordset?.[0]?.Flag || 0);

    // Audit log
    try {
      await webDB.query(
        `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
         VALUES (@actor, 'ADMIN_VERIFY', @details, @ip)`,
        {
          actor,
          details: `target=${account}; before=${beforeFlag}; after=${updatedFlag}`,
          ip,
        }
      );
    } catch {}

    return NextResponse.json({ ok: true, Flag: updatedFlag });
  } catch (error) {
    console.error('Admin verify error:', error);
    return NextResponse.json(
      { error: 'Verify failed' },
      { status: 500 }
    );
  }
}
