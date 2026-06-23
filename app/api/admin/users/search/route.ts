import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB, serverDB, webDB } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;
    const ip = (request.headers.get('x-forwarded-for') || '')
      .split(',')[0]
      .trim() || request.headers.get('x-real-ip') || '127.0.0.1';

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'account').toLowerCase();
    const q = (searchParams.get('q') || '').trim();
    const banned = searchParams.get('banned') === '1' || searchParams.get('banned') === 'true';
    const gm = searchParams.get('gm') === '1' || searchParams.get('gm') === 'true';
    const pending = searchParams.get('pending') === '1' || searchParams.get('pending') === 'true';

    const adminCheck = await userDB.query(
      `SELECT ISNULL(GameMasterType,0) as GameMasterType, ISNULL(GameMasterLevel,0) as GameMasterLevel
       FROM UserInfo WHERE AccountName = @username`,
      { username }
    );
    if (!adminCheck.recordset?.length) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const gmrow = adminCheck.recordset[0];
    if (!(gmrow.GameMasterType === 1 && gmrow.GameMasterLevel >= 3)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (type === 'character') {
      if (!q) return NextResponse.json({ results: [], type: 'character' });
      const res = await userDB.query(
        `SELECT TOP 25 
           ci.Name,
           ci.JobCode,
           ci.Level,
           ci.Experience,
           ci.AccountName,
           ISNULL(cr.RebornStage, 0) as RebornStage,
           ISNULL(cr.RebornCount, 0) as RebornCount,
           ISNULL(ui.BanStatus, 0) as BanStatus,
           ui.Email,
           ISNULL(ui.Coins, 0) as Coins
         FROM CharacterInfo ci
         LEFT JOIN CharacterReborn cr ON ci.Name = cr.CharacterName
         INNER JOIN UserInfo ui ON ci.AccountName = ui.AccountName
         WHERE ci.Name LIKE @q
         ORDER BY ci.Name`,
        { q: `${q}%` }
      );
      const results = res.recordset || [];
      // Attach online status in batch
      try {
        const names = Array.from(new Set(results.map((r: any) => r.Name).filter(Boolean)));
        if (names.length > 0) {
          const quoted = names.map((n) => `'${String(n).replace(/'/g, "''")}'`).join(',');
          const onlineRows = await serverDB.query<{ CharacterName: string }>(
            `SELECT CharacterName FROM UsersOnline WHERE CharacterName IN (${quoted})`
          );
          const onlineSet = new Set((onlineRows.recordset || []).map((r: any) => r.CharacterName));
          for (const r of results as any[]) {
            (r as any).IsOnline = onlineSet.has(r.Name);
          }
        }
      } catch (e) {
        console.error('Admin search online lookup failed:', e);
      }
      try {
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
           VALUES (@actor, 'ADMIN_SEARCH_CHARACTERS', @details, @ip)`,
          { actor: username, details: `q=${q}; count=${results.length}`, ip }
        );
      } catch {}
      return NextResponse.json({ results, type: 'character' });
    }

    let res;
    if (banned) {
      res = await userDB.query(
        `SELECT 
           ui.AccountName,
           ui.Email,
           ISNULL(ui.Coins, 0) as Coins,
           ISNULL(utc.Coins, 0) as TimePoints,
           ISNULL(ui.BanStatus, 0) as BanStatus,
           ISNULL(ui.GameMasterType, 0) as GameMasterType,
           ISNULL(ui.GameMasterLevel, 0) as GameMasterLevel,
           ui.RegisDay,
           ISNULL(ui.Flag,0) as Flag
         FROM UserInfo ui
         LEFT JOIN UserTimeCoin utc ON ui.AccountName = utc.AccountName
         WHERE ISNULL(ui.BanStatus,0) = 1
         ORDER BY ui.AccountName`,
      );
      try {
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
           VALUES (@actor, 'ADMIN_FILTER_BANNED', @details, @ip)`,
          { actor: username, details: `count=${res.recordset?.length || 0}` , ip }
        );
      } catch {}
    } else if (gm) {
      res = await userDB.query(
        `SELECT 
           ui.AccountName,
           ui.Email,
           ISNULL(ui.Coins, 0) as Coins,
           ISNULL(utc.Coins, 0) as TimePoints,
           ISNULL(ui.BanStatus, 0) as BanStatus,
           ISNULL(ui.GameMasterType, 0) as GameMasterType,
           ISNULL(ui.GameMasterLevel, 0) as GameMasterLevel,
           ui.RegisDay,
           ISNULL(ui.Flag,0) as Flag
         FROM UserInfo ui
         LEFT JOIN UserTimeCoin utc ON ui.AccountName = utc.AccountName
         WHERE ISNULL(ui.GameMasterType,0) >= 1
         ORDER BY ui.AccountName`
      );
      try {
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
           VALUES (@actor, 'ADMIN_FILTER_GM', @details, @ip)`,
          { actor: username, details: `count=${res.recordset?.length || 0}` , ip }
        );
      } catch {}
    } else if (pending) {
      res = await userDB.query(
        `SELECT 
           ui.AccountName,
           ui.Email,
           ISNULL(ui.Coins, 0) as Coins,
           ISNULL(utc.Coins, 0) as TimePoints,
           ISNULL(ui.BanStatus, 0) as BanStatus,
           ISNULL(ui.GameMasterType, 0) as GameMasterType,
           ISNULL(ui.GameMasterLevel, 0) as GameMasterLevel,
           ui.RegisDay,
           ISNULL(ui.Flag,0) as Flag
         FROM UserInfo ui
         LEFT JOIN UserTimeCoin utc ON ui.AccountName = utc.AccountName
         WHERE ISNULL(ui.Flag,0) < 98
         ORDER BY ui.AccountName`
      );
      try {
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
           VALUES (@actor, 'ADMIN_FILTER_PENDING', @details, @ip)`,
          { actor: username, details: `count=${res.recordset?.length || 0}`, ip }
        );
      } catch {}
    } else {
      if (!q) return NextResponse.json({ results: [], type: 'account' });
      res = await userDB.query(
        `SELECT TOP 25 
           ui.AccountName,
           ui.Email,
           ISNULL(ui.Coins, 0) as Coins,
           ISNULL(utc.Coins, 0) as TimePoints,
           ISNULL(ui.BanStatus, 0) as BanStatus,
           ISNULL(ui.GameMasterType, 0) as GameMasterType,
           ISNULL(ui.GameMasterLevel, 0) as GameMasterLevel,
           ui.RegisDay,
           ISNULL(ui.Flag,0) as Flag
         FROM UserInfo ui
         LEFT JOIN UserTimeCoin utc ON ui.AccountName = utc.AccountName
         WHERE ui.AccountName LIKE @q
         ORDER BY ui.AccountName`,
        { q: `${q}%` }
      );
      try {
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
           VALUES (@actor, 'ADMIN_SEARCH_ACCOUNTS', @details, @ip)`,
          { actor: username, details: `q=${q}; count=${res.recordset?.length || 0}`, ip }
        );
      } catch {}
    }
    return NextResponse.json({ results: res.recordset, type: 'account' });
  } catch (error) {
    console.error('Admin search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
