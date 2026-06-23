import { NextRequest, NextResponse } from 'next/server';
import { serverDB, clanDB } from '@/lib/db';
import { cached } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'personal'; // personal or clan
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50')));
    const offset = (page - 1) * pageSize;

    const key = `rankings:pvp:${type}:p${page}:s${pageSize}`;
    const data = await cached(key, 60_000, async () => {
      if (type === 'personal') {
        const base = `
          SELECT DISTINCT
            PvP.CharacterID,
            PvP.CharacterClass,
            PvP.Experience,
            PvP.Kills,
            PvP.Deaths,
            PvP.Streak,
            PvP.TopPvP,
            PvP.Date,
            CI.Name,
            CI.JobCode,
            CI.Level
          FROM PvPPlayerRank PvP
          INNER JOIN UserDB.dbo.CharacterInfo CI ON PvP.CharacterID = CI.ID
          WHERE CI.AccountName NOT IN ('botro', 'jamai', 'botrojamai', 'aquariusbotro', 'tromailai', 'gmzeus88', 'taleowner', 'Dreddtoters', 'GMCronus')
            AND CI.Level > 70
            AND (PvP.Experience > 0 OR PvP.Kills > 0)
          ORDER BY PvP.Experience DESC, PvP.Kills DESC, PvP.Streak DESC
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
            PVPKills: player.Kills,
            PVPDeaths: player.Deaths,
          };
        });
        const hasMore = basePlayers.length > pageSize;
        return { items, hasMore };
      } else {
        const base = `
          SELECT 
            c.ClanName,
            p.Experience,
            p.Kills,
            p.Deaths,
            p.Streak,
            c.IconID
          FROM ServerDB.dbo.PvPClanRank p
          JOIN ClanDB.dbo.ClanList c ON c.ID = p.ClanID
          WHERE c.ClanName != 'Conquerors'
            AND (p.Experience > 0 OR p.Kills > 0)
          ORDER BY p.Experience DESC, p.Kills DESC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `;
        const result = await serverDB.query(base, { offset, limit: pageSize + 1 });
        const rows = (result.recordset || []) as any[];
        const items = rows.slice(0, pageSize).map((clan) => ({
          ClanName: clan.ClanName,
          Experience: clan.Experience,
          Kills: clan.Kills,
          Deaths: clan.Deaths,
          Streak: clan.Streak,
          IconID: clan.IconID,
          PVPWins: clan.Kills,
        }));
        const hasMore = rows.length > pageSize;
        return { items, hasMore };
      }
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching PvP rankings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rankings' },
      { status: 500 }
    );
  }
}
