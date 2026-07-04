import { NextRequest, NextResponse } from 'next/server';
import { clanDB, userDB } from '@/lib/db';
import { cached } from '@/lib/cache';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'rankings-bellatra', 60, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'personal';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50')));
    const offset = (page - 1) * pageSize;

    const key = `rankings:bellatra:${type}:p${page}:s${pageSize}`;
    const data = await cached(key, 60_000, async () => {
      if (type === 'personal') {
        const base = `
          SELECT 
            CharacterName,
            Kills,
            Score,
            Date,
            AccountName
          FROM BellatraPersonalScore
          WHERE AccountName NOT IN ('botro', 'jamai', 'botrojamai', 'aquariusbotro', 'tromailai', 'gmzeus88', 'taleowner', 'Dreddtoters', 'GMCronus')
            AND Score > 0
          ORDER BY Score DESC, Kills DESC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `;
        const result = await clanDB.query(base, { offset, limit: pageSize + 1 });
        const rows = (result.recordset || []) as any[];

        const names: string[] = Array.from(new Set(rows.map((r) => r.CharacterName).filter(Boolean))).map((n) => String(n));
        const charByName = new Map<string, { Name: string; JobCode: number; ClanID: number; Level: number }>();
        if (names.length > 0) {
          const inNames = names.map((n) => `'${n.replace(/'/g, "''")}'`).join(',');
          try {
            const charRes = await userDB.query<{ Name: string; JobCode: number; ClanID: number; Level: number }>(
              `SELECT Name, JobCode, ClanID, Level FROM CharacterInfo WHERE Name IN (${inNames})`
            );
            for (const row of charRes.recordset || []) {
              charByName.set(row.Name, row);
            }
          } catch {}
        }

        const clanIDs = Array.from(new Set(Array.from(charByName.values()).map((c) => c.ClanID).filter((id) => (id || 0) > 0)));
        const clanById = new Map<number, { ID: number; ClanName: string; IconID: number }>();
        if (clanIDs.length > 0) {
          const inIds = clanIDs.join(',');
          try {
            const clanRes = await clanDB.query<{ ID: number; ClanName: string; IconID: number }>(
              `SELECT ID, ClanName, IconID FROM ClanList WHERE ID IN (${inIds})`
            );
            for (const row of clanRes.recordset || []) {
              clanById.set(Number(row.ID), { ID: Number(row.ID), ClanName: row.ClanName || 'No Clan', IconID: Number(row.IconID) || 0 });
            }
          } catch {}
        }

        const items = rows.slice(0, pageSize).map((score) => {
          const char = charByName.get(score.CharacterName) || { Name: score.CharacterName, JobCode: 0, ClanID: 0, Level: 0 };
          const clan = clanById.get(char.ClanID) || { ID: 0, ClanName: 'No Clan', IconID: 0 };
          return {
            Name: char.Name,
            JobCode: char.JobCode,
            Level: char.Level,
            ClanID: char.ClanID,
            ClanName: clan.ClanName,
            IconID: clan.IconID,
            SODKills: score.Kills,
            Score: score.Score,
            Date: score.Date,
          };
        });
        const hasMore = rows.length > pageSize;
        return { items, hasMore };
      } else {
        const base = `
          SELECT 
            ClanName, IconID, BellatraPoints, BellatraDate
          FROM ClanList
          WHERE BellatraPoints > 0
            AND ClanName != 'Conquerors'
          ORDER BY BellatraPoints DESC, BellatraDate DESC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `;
        const result = await clanDB.query(base, { offset, limit: pageSize + 1 });
        const rows = (result.recordset || []) as any[];
        const items = rows.slice(0, pageSize).map((clan) => ({
          ClanName: clan.ClanName,
          IconID: clan.IconID,
          BellatraPoints: clan.BellatraPoints,
          BellatraDate: clan.BellatraDate,
        }));
        const hasMore = rows.length > pageSize;
        return { items, hasMore };
      }
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Bellatra rankings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rankings' },
      { status: 500 }
    );
  }
}
