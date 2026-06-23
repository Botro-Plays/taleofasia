import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB, clanDB } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;
    const { searchParams } = new URL(request.url);
    const name = (searchParams.get('name') || '').trim();

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

    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

    const data = await userDB.query(
      `SELECT TOP 1 * FROM CharacterData WHERE CharacterName = @name`,
      { name }
    );
    const row: any = data.recordset?.[0] || null;

    let clan: { ClanID: number; ClanName: string; IconID: number } | null = null;
    try {
      let clanID = Number(row?.ClanID || 0);
      if (!clanID || clanID <= 0) {
        // Fallback: read from CharacterInfo
        try {
          const ci = await userDB.query(`SELECT TOP 1 ClanID FROM CharacterInfo WHERE Name = @name`, { name });
          const ciClanID = Number(ci.recordset?.[0]?.ClanID || 0);
          if (ciClanID > 0) clanID = ciClanID;
        } catch {}
      }
      if (clanID > 0) {
        let clanName = 'Unknown';
        let iconID = 0;
        try {
          const clRes = await clanDB.query(`SELECT ClanName FROM CL WHERE IDX = @id`, { id: clanID });
          if (clRes.recordset?.length) clanName = clRes.recordset[0].ClanName || 'Unknown';
        } catch {}
        try {
          const iconRes = await clanDB.query(`SELECT IconID FROM ClanList WHERE ClanName = @clanName`, { clanName });
          if (iconRes.recordset?.length) iconID = Number(iconRes.recordset[0].IconID || 0);
        } catch {}
        clan = { ClanID: clanID, ClanName: clanName, IconID: iconID };
      }
    } catch {}

    return NextResponse.json({ data: row, clan });
  } catch (error) {
    console.error('Admin character-data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch character data' },
      { status: 500 }
    );
  }
}
