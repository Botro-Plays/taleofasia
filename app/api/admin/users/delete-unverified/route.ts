import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB, webDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;
    const adminCheck = await userDB.query(
      `SELECT ISNULL(GameMasterType,0) as GameMasterType, ISNULL(GameMasterLevel,0) as GameMasterLevel
       FROM UserInfo WHERE AccountName = @username`,
      { username }
    );
    if (!adminCheck.recordset?.length) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const gm = adminCheck.recordset[0];
    // Only Super Admins may perform mass deletions
    if (!(gm.GameMasterType === 1 && gm.GameMasterLevel >= 3)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const days = Math.max(0, Number(body?.days ?? 30));
    const ip = (request.headers.get('x-forwarded-for') || '')
      .split(',')[0]
      .trim() || request.headers.get('x-real-ip') || '127.0.0.1';

    // Collect accounts to be deleted first
    const toDelete = await userDB.query(
      `SELECT AccountName FROM UserInfo 
       WHERE ISNULL(Flag,0) < 98 
         AND DATEDIFF(DAY, RegisDay, GETDATE()) >= @days
         AND ISNULL(GameMasterType,0) = 0`,
      { days }
    );

    const count = toDelete.recordset?.length || 0;

    if (count > 0) {
      await userDB.query(
        `DELETE FROM UserInfo 
         WHERE ISNULL(Flag,0) < 98 
           AND DATEDIFF(DAY, RegisDay, GETDATE()) >= @days
           AND ISNULL(GameMasterType,0) = 0`,
        { days }
      );
    }

    await webDB.query(
      `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
       VALUES (@actor, 'ADMIN_PURGE_UNVERIFIED', @details, @ip)`,
      {
        actor: username,
        details: `days=${days}; deleted=${count}`,
        ip,
      }
    );

    return NextResponse.json({ deleted: count });
  } catch (error) {
    console.error('Delete unverified accounts failed:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
