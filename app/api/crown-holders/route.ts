import { NextRequest, NextResponse } from 'next/server';
import { clanDB, serverDB } from '@/lib/db';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

type CrownData = { blessCastle: { clanName: string; iconID: number } | null; surviveOrDie: { clanName: string; iconID: number } | null };

let blessCastleCache: { data: CrownData['blessCastle']; ts: number } | null = null;
let bellatraCache: { data: CrownData['surviveOrDie']; ts: number } | null = null;
const BLESS_CACHE_TTL = 5 * 60 * 1000;
const BELLATRA_CACHE_TTL = 60 * 1000;

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'crown-holders', 30, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const data: CrownData = {
      blessCastle: null,
      surviveOrDie: null,
    };

    if (blessCastleCache && Date.now() - blessCastleCache.ts < BLESS_CACHE_TTL) {
      data.blessCastle = blessCastleCache.data;
    } else {
      try {
        const blessCastleResult = await serverDB.query(`
          SELECT TOP 1 ClanID FROM BlessCastleSettings WHERE ClanID > 0
        `);

        if (blessCastleResult.recordset && blessCastleResult.recordset.length > 0) {
          const clanID = blessCastleResult.recordset[0].ClanID;

          const clanResult = await clanDB.query(`
            SELECT ClanName, IconID FROM ClanList WHERE ID = @clanID
          `, { clanID });

          if (clanResult.recordset && clanResult.recordset.length > 0) {
            const clan = clanResult.recordset[0];
            data.blessCastle = {
              clanName: clan.ClanName,
              iconID: clan.IconID,
            };
          }
        }
        blessCastleCache = { data: data.blessCastle, ts: Date.now() };
      } catch (error) {
        console.error('Error fetching Bless Castle holder:', error);
        if (blessCastleCache) data.blessCastle = blessCastleCache.data;
      }
    }

    if (bellatraCache && Date.now() - bellatraCache.ts < BELLATRA_CACHE_TTL) {
      data.surviveOrDie = bellatraCache.data;
    } else {
      try {
        const bellatraResult = await clanDB.query(`
          SELECT TOP 1 ID, ClanName, IconID
          FROM ClanList
          WHERE BellatraPoints > 0 AND ClanName != 'Conquerors'
          ORDER BY BellatraPoints DESC, BellatraDate DESC
        `);

        if (bellatraResult.recordset && bellatraResult.recordset.length > 0) {
          const clan = bellatraResult.recordset[0];
          data.surviveOrDie = {
            clanName: clan.ClanName,
            iconID: clan.IconID,
          };
        }
        bellatraCache = { data: data.surviveOrDie, ts: Date.now() };
      } catch (error) {
        console.error('Error fetching Bellatra holder:', error);
        if (bellatraCache) data.surviveOrDie = bellatraCache.data;
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching crown holders:', error);
    return NextResponse.json(
      { blessCastle: null, surviveOrDie: null },
      { status: 500 }
    );
  }
}
