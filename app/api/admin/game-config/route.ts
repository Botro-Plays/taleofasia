import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB, userDB, clanDB, serverDB } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;

    const adminCheck = await userDB.query(`
      SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username
    `, { username });

    if (!adminCheck.recordset || adminCheck.recordset.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const user = adminCheck.recordset[0];
    if (!(user.GameMasterType === 1 && user.GameMasterLevel >= 4)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Crown holders
    const crownHolders: any = { blessCastle: null, bellatra: null };

    try {
      const bcResult = await serverDB.query(`
        SELECT TOP 1 ClanID FROM BlessCastleSettings WHERE ClanID > 0
      `);
      if (bcResult.recordset?.length > 0) {
        const clanID = bcResult.recordset[0].ClanID;
        const clanResult = await clanDB.query(`
          SELECT ClanName, IconID FROM ClanList WHERE ID = @clanID
        `, { clanID });
        if (clanResult.recordset?.length > 0) {
          crownHolders.blessCastle = clanResult.recordset[0];
        }
      }
    } catch (e) {
      console.error('BlessCastle fetch error:', e);
    }

    try {
      const bellResult = await clanDB.query(`
        SELECT TOP 1 ClanName, IconID, BellatraPoints
        FROM ClanList
        WHERE BellatraPoints > 0 AND ClanName != 'Conquerors'
        ORDER BY BellatraPoints DESC, BellatraDate DESC
      `);
      if (bellResult.recordset?.length > 0) {
        crownHolders.bellatra = bellResult.recordset[0];
      }
    } catch (e) {
      console.error('Bellatra fetch error:', e);
    }

    // Game settings from WebDB
    const settings: Record<string, string> = {};
    try {
      const settingsResult = await webDB.query(`
        SELECT SettingKey, SettingValue FROM GameSettings
      `);
      for (const row of settingsResult.recordset) {
        settings[row.SettingKey] = row.SettingValue;
      }
    } catch (e) {
      console.error('GameSettings fetch error (table may not exist):', e);
    }

    return NextResponse.json({ crownHolders, settings });
  } catch (error) {
    console.error('Error fetching game config:', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;

    const adminCheck = await userDB.query(`
      SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username
    `, { username });

    if (!adminCheck.recordset || adminCheck.recordset.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const user = adminCheck.recordset[0];
    if (!(user.GameMasterType === 1 && user.GameMasterLevel >= 4)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { settings } = body;

    // Upsert settings (create table if needed via individual MERGE-like logic)
    for (const [key, value] of Object.entries(settings)) {
      try {
        // Try update first
        const updateResult = await webDB.query(`
          UPDATE GameSettings SET SettingValue = @value, LastUpdated = GETDATE()
          WHERE SettingKey = @key
        `, { key, value: value as string });

        // If no rows updated, insert
        if (updateResult.rowsAffected?.[0] === 0) {
          await webDB.query(`
            INSERT INTO GameSettings (SettingKey, SettingValue, LastUpdated)
            VALUES (@key, @value, GETDATE())
          `, { key, value: value as string });
        }
      } catch (e) {
        console.error(`Error saving setting ${key}:`, e);
      }
    }

    return NextResponse.json({ message: 'Settings saved' });
  } catch (error) {
    console.error('Error saving game config:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
