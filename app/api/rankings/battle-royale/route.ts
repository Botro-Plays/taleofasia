import { NextRequest, NextResponse } from 'next/server';
import { serverDB, clanDB } from '@/lib/db';
import { cached } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50')));
    const offset = (page - 1) * pageSize;

    const key = `rankings:br:p${page}:s${pageSize}`;
    const data = await cached(key, 60_000, async () => {
      const base = `
        SELECT 
          BR.CharacterID,
          BR.Kills,
          BR.Deaths,
          BR.Wins,
          BR.Points,
          BR.Date,
          CI.Name,
          CI.JobCode,
          CI.Level
        FROM dbo.BattleRoyaleCharacterRanking BR
        INNER JOIN UserDB.dbo.CharacterInfo CI ON BR.CharacterID = CI.ID
        WHERE CI.AccountName NOT IN ('botro', 'jamai', 'botrojamai', 'aquariusbotro', 'tromailai', 'gmzeus88', 'taleowner', 'Dreddtoters', 'GMCronus')
          AND CI.Level > 70
          AND (BR.Points > 0 OR BR.Kills > 0 OR BR.Wins > 0)
        ORDER BY BR.Points DESC, BR.Kills DESC, BR.Wins DESC, BR.Deaths ASC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `;
      const result = await serverDB.query(base, { offset, limit: pageSize + 1 });

      const basePlayers = (result.recordset || []) as any[];
      const names: string[] = Array.from(new Set(basePlayers.map((p) => p.Name).filter(Boolean)));
      const clanByName = new Map<string, { IDX: number; ClanName: string; IconID: number }>();
      if (names.length > 0) {
        const inNames = names.map((n) => `'${String(n).replace(/'/g, "''")}'`).join(',');
        try {
          const clanResult = await clanDB.query<{ ChName: string; IDX: number; ClanName: string; IconID: number }>(`
            SELECT UL.ChName, UL.IDX, UL.ClanName, CL.IconID
            FROM UL
            LEFT JOIN ClanList CL ON UL.ClanName = CL.ClanName
            WHERE UL.ChName IN (${inNames})
          `);
          for (const row of clanResult.recordset || []) {
            clanByName.set(row.ChName, {
              IDX: Number(row.IDX) || 0,
              ClanName: row.ClanName || 'No Clan',
              IconID: Number(row.IconID) || 0,
            });
          }
        } catch {}
      }

      const items = basePlayers.slice(0, pageSize).map((player) => {
        const clan = clanByName.get(player.Name) || { IDX: 0, ClanName: 'No Clan', IconID: 0 };
        return {
          ...player,
          ClanID: clan.IDX,
          ClanName: clan.ClanName,
          IconID: clan.IconID,
          BRKills: player.Kills,
          BRWins: player.Wins,
        };
      });
      const hasMore = basePlayers.length > pageSize;
      return { items, hasMore };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Battle Royale rankings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rankings' },
      { status: 500 }
    );
  }
}
