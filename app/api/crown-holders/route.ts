import { NextResponse } from 'next/server';
import { clanDB, serverDB } from '@/lib/db';

export async function GET() {
  try {
    const data: any = {
      blessCastle: null,
      surviveOrDie: null,
    };

    // Get Bless Castle crown holder from BlessCastleSettings (ServerDB)
    try {
      const blessCastleResult = await serverDB.query(`
        SELECT TOP 1 ClanID FROM BlessCastleSettings WHERE ClanID > 0
      `);

      if (blessCastleResult.recordset && blessCastleResult.recordset.length > 0) {
        const clanID = blessCastleResult.recordset[0].ClanID;

        // Get clan info from ClanList (ClanDB)
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
    } catch (error) {
      console.error('Error fetching Bless Castle holder:', error);
    }

    // Get Bellatra (Survive or Die) crown holder - Top clan by BellatraPoints
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
    } catch (error) {
      console.error('Error fetching Bellatra holder:', error);
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
