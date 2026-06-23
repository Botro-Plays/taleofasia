import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'account').toLowerCase();
    const q = (searchParams.get('q') || '').trim();

    const adminCheck = await userDB.query(
      `SELECT ISNULL(GameMasterType,0) as GameMasterType, ISNULL(GameMasterLevel,0) as GameMasterLevel
       FROM UserInfo WHERE AccountName = @username`,
      { username }
    );
    if (!adminCheck.recordset?.length) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const gm = adminCheck.recordset[0];
    if (!(gm.GameMasterType === 1 && gm.GameMasterLevel >= 3)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!q) return NextResponse.json({ suggestions: [] });

    if (type === 'character') {
      const res = await userDB.query(
        `SELECT TOP 8 Name FROM CharacterInfo WHERE Name LIKE @q ORDER BY Name`,
        { q: `${q}%` }
      );
      return NextResponse.json({ suggestions: res.recordset.map((r:any) => r.Name), type: 'character' });
    }

    const res = await userDB.query(
      `SELECT TOP 8 AccountName FROM UserInfo WHERE AccountName LIKE @q ORDER BY AccountName`,
      { q: `${q}%` }
    );
    return NextResponse.json({ suggestions: res.recordset.map((r:any) => r.AccountName), type: 'account' });
  } catch (error) {
    console.error('Admin suggest error:', error);
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
