import { NextRequest, NextResponse } from 'next/server';
import { userDB, clanDB } from '@/lib/db';
import { cached } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobCode = searchParams.get('class');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50')));
    const offset = (page - 1) * pageSize;

    const key = `rankings:level:${jobCode || 'all'}:p${page}:s${pageSize}`;
    const data = await cached(key, 60_000, async () => {
      let base = `
        SELECT 
          ci.Name, ci.JobCode, ci.Level, ci.Experience,
          cr.RebornStage, cr.RebornCount
        FROM CharacterInfo ci
        LEFT JOIN CharacterReborn cr ON ci.Name = cr.CharacterName
        INNER JOIN UserInfo ui ON ci.AccountName = ui.AccountName
        WHERE ci.AccountName NOT IN ('botro', 'jamai', 'botrojamai', 'aquariusbotro', 'tromailai', 'gmzeus88', 'taleowner', 'Dreddtoters', 'GMCronus')
          AND ci.Level >= 100
          AND ISNULL(ui.GameMasterType, 0) <> 1
          AND ISNULL(ui.BanStatus, 0) <> 1
      `;

      const params: Record<string, any> = { offset, pageSize: pageSize + 1 };

      if (jobCode && jobCode !== 'all') {
        base += ' AND ci.JobCode = @jobCode';
        params.jobCode = parseInt(jobCode);
      }

      base += ' ORDER BY cr.RebornStage DESC, cr.RebornCount DESC, ci.Level DESC, ci.Experience DESC, ci.DateLevelUP ASC';
      base += ' OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY';

      const result = await userDB.query(base, params);
      const rows: any[] = result.recordset || [];

      // Batch clan info for names on this page
      const names: string[] = Array.from(new Set(rows.map((r) => r.Name).filter(Boolean))).map((n) => String(n));
      const clanByName = new Map<string, { IDX: number; ClanName: string; IconID: number }>();
      if (names.length > 0) {
        const inNames = names.map((n) => `'${n.replace(/'/g, "''")}'`).join(',');
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
        } catch {
          // continue without clan data
        }
      }

      const items = rows.slice(0, pageSize).map((player) => {
        const clan = clanByName.get(player.Name) || { IDX: 0, ClanName: 'No Clan', IconID: 0 };
        return {
          ...player,
          RebornStage: player.RebornStage ?? 0,
          RebornCount: player.RebornCount ?? 0,
          ClanID: clan.IDX,
          ClanName: clan.ClanName,
          IconID: clan.IconID,
        };
      });

      const hasMore = rows.length > pageSize;
      return { items, hasMore };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching level rankings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rankings' },
      { status: 500 }
    );
  }
}
