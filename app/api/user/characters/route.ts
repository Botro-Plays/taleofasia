import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB, clanDB, serverDB, webDB } from '@/lib/db';
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const username = session.user.id;

    const MAX_LEVEL = 150;
    // Run characters and user info queries in parallel
    const [charactersResult, userResult] = await Promise.all([
      userDB.query(`
        SELECT TOP 6
          ci.Name, ci.Level, ci.Experience, ci.JobCode, ci.ClanID, ci.Gold,
          cr.RebornStage, cr.RebornCount
        FROM CharacterInfo ci
        LEFT JOIN CharacterReborn cr ON ci.Name = cr.CharacterName
        WHERE ci.AccountName = @username
      `, { username }),
      userDB.query(`
        SELECT Email, Coins
        FROM UserInfo
        WHERE AccountName = @username
      `, { username }),
    ]);

    const baseCharacters = charactersResult.recordset || [];

    // Batch fetch clan names for all characters with ClanID > 0
    const clanIds = Array.from(new Set(baseCharacters.map((c: any) => c.ClanID).filter((id: number) => id > 0)));
    let clanMap = new Map<number, { ClanName: string; ClanZang: string }>();
    if (clanIds.length > 0) {
      const inList = clanIds.join(',');
      try {
        const clans = await clanDB.query<{ IDX: number; ClanName: string; ClanZang: string }>(`
          SELECT IDX, ClanName, ClanZang FROM CL WHERE IDX IN (${inList})
        `);
        clanMap = new Map(clans.recordset.map((r: any) => [r.IDX, { ClanName: r.ClanName, ClanZang: r.ClanZang }]));
      } catch (e) {
        console.error('Batch clan lookup failed:', e);
      }
    }

    // Determine which characters are currently online in a single query
    const names: string[] = Array.from(new Set(baseCharacters.map((c: any) => c.Name).filter(Boolean)));
    let onlineSet = new Set<string>();
    if (names.length > 0) {
      const quoted = names.map((n) => `'${String(n).replace(/'/g, "''")}'`).join(',');
      try {
        const onlineRows = await serverDB.query<{ CharacterName: string }>(`
          SELECT CharacterName FROM UsersOnline WHERE CharacterName IN (${quoted})
        `);
        onlineSet = new Set((onlineRows.recordset || []).map((r: any) => r.CharacterName));
      } catch (e) {
        console.error('Online status lookup failed:', e);
      }
    }

    // Fetch ExpTotal for current level and next level (ID and ID+1) from WebDB.ExperienceTable
    const levels = Array.from(new Set(baseCharacters.map((c: any) => c.Level).filter((lv: number) => typeof lv === 'number')));
    let expByLevel = new Map<number, { total: number; required: number }>();
    if (levels.length > 0) {
      const levelPlusOne = Array.from(new Set(levels.map((lv) => lv + 1)));
      const idsSet = Array.from(new Set([...levels, ...levelPlusOne]));
      const inLevels = idsSet.join(',');
      try {
        const expRows = await webDB.query<{ ID: number; ExpTotal: number; ExpRequired: number }>(`
          SELECT ID, ExpTotal, ExpRequired FROM ExperienceTable WHERE ID IN (${inLevels})
        `);
        expByLevel = new Map((expRows.recordset || []).map((r: any) => [
          Number(r.ID),
          { total: Number(r.ExpTotal ?? 0), required: Number(r.ExpRequired ?? 0) }
        ]));
      } catch (e) {
        console.error('ExperienceTable lookup failed:', e);
      }
    }

    const characters = baseCharacters.map((character: any) => {
      const clan = character.ClanID > 0 ? clanMap.get(character.ClanID) : undefined;
      const clanName = clan ? (clan.ClanName || 'Unknown') : (character.ClanID > 0 ? 'Unknown' : 'None');
      const isClanLeader = clan ? clan.ClanZang === character.Name : false;
      const IsOnline = onlineSet.has(character.Name);
      const expRowCur = expByLevel.get(character.Level) || { total: 0, required: 0 };
      const ExpTotalAtLevel = expRowCur.total;
      const ExpRequiredAtLevel = character.Level >= MAX_LEVEL ? 0 : (expRowCur.required || 0); // per-level required amount
      return { ...character, ClanName: clanName, IsClanLeader: isClanLeader, IsOnline, ExpTotalAtLevel, ExpRequiredAtLevel };
    });

    const userData = userResult.recordset.length > 0 ? userResult.recordset[0] : null;

    return NextResponse.json({ characters, user: userData }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error fetching user characters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}
