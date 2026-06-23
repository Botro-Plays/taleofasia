import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB, userDB } from '@/lib/db';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;

    // Check if user is admin (>=3)
    const adminCheck = await userDB.query(`
      SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username
    `, { username });
    if (!adminCheck.recordset || adminCheck.recordset.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const user = adminCheck.recordset[0];
    const isAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 3;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    const ip = (url.searchParams.get('ip') || '').trim();
    const who = (url.searchParams.get('user') || '').trim();
    const action = (url.searchParams.get('action') || '').trim();
    const details = (url.searchParams.get('details') || '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') || '10')));
    const sort = (url.searchParams.get('sort') || 'newest').toLowerCase(); // 'newest' | 'oldest'
    const csv = (url.searchParams.get('csv') || '') === '1';
    const minIpCount = Math.max(0, Number(url.searchParams.get('minIpCount') || '0'));
    const minActorCount = Math.max(0, Number(url.searchParams.get('minActorCount') || '0'));
    const showHiddenParam = (url.searchParams.get('showHidden') || '') === '1';

    const where: string[] = [];
    const params: Record<string, any> = {};
    if (q) {
      where.push('(Action LIKE @q OR Details LIKE @q OR IPAddress LIKE @q OR AccountName LIKE @q)');
      params.q = `%${q}%`;
    }
    if (ip) { where.push('IPAddress LIKE @ip'); params.ip = `%${ip}%`; }
    if (who) { where.push('AccountName LIKE @who'); params.who = `%${who}%`; }
    if (action) { where.push('Action LIKE @action'); params.action = `%${action}%`; }
    if (details) { where.push('Details LIKE @details'); params.details = `%${details}%`; }
    
    // Determine if IsHidden column exists
    const hiddenColCheck = await webDB.query(
      `SELECT 1 AS HasColumn FROM sys.columns WHERE Name = N'IsHidden' AND Object_ID = Object_ID(N'WebAuditLogs')`
    );
    const hasIsHidden = !!hiddenColCheck.recordset?.length;
    const isSuperAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 4;
    if (hasIsHidden) {
      if (!isSuperAdmin) {
        where.push('(l.IsHidden = 0)');
      } else if (!showHiddenParam) {
        where.push('(l.IsHidden = 0)');
      }
    }

    // Frequent IP / Actor filters (server-side aggregation)
    let joinSql = '';
    if (minIpCount > 0) {
      joinSql += ` INNER JOIN (SELECT IPAddress, COUNT(*) AS Cnt FROM WebAuditLogs GROUP BY IPAddress HAVING COUNT(*) >= @minIpCount) ipf ON ipf.IPAddress = l.IPAddress`;
      params.minIpCount = minIpCount;
    }
    if (minActorCount > 0) {
      joinSql += ` INNER JOIN (SELECT AccountName, COUNT(*) AS Cnt FROM WebAuditLogs GROUP BY AccountName HAVING COUNT(*) >= @minActorCount) af ON af.AccountName = l.AccountName`;
      params.minActorCount = minActorCount;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderSql = sort === 'oldest' ? 'ORDER BY Timestamp ASC' : 'ORDER BY Timestamp DESC';
    const offset = (page - 1) * pageSize;
    const totalRes = await webDB.query(
      `SELECT COUNT(*) as Total FROM WebAuditLogs l ${joinSql} ${whereSql}`,
      params
    );
    const total = Number(totalRes.recordset?.[0]?.Total || 0);

    // CSV export path (no pagination; cap to 10000 for safety)
    if (csv) {
      const exportLimit = Math.min(10000, Math.max(1, Number(url.searchParams.get('limit') || '10000')));
      const exp = await webDB.query(
        `SELECT LogID, AccountName, Action, Details, IPAddress, Timestamp${hasIsHidden ? ', IsHidden' : ''}
         FROM WebAuditLogs l
         ${joinSql}
         ${whereSql}
         ${orderSql}
         OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY`,
        { ...params, limit: exportLimit }
      );
      const rows = exp.recordset || [];
      const headers = ['LogID','AccountName','Action','Details','IPAddress','Timestamp'].concat(hasIsHidden ? ['IsHidden'] : []);
      const csvLines = [headers.join(',')].concat(
        rows.map((r: any) => headers.map(h => {
          const val = r[h];
          const s = val == null ? '' : String(val);
          // Escape CSV
          const needsQuote = /[",\n]/.test(s);
          const escaped = s.replace(/"/g, '""');
          return needsQuote ? `"${escaped}"` : escaped;
        }).join(','))
      );
      const text = csvLines.join('\n');
      return new NextResponse(text, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="audit_logs.csv"',
        }
      });
    }

    const logs = await webDB.query(
      `SELECT LogID, AccountName, Action, Details, IPAddress, Timestamp${hasIsHidden ? ', IsHidden' : ''}
       FROM WebAuditLogs l
       ${joinSql}
       ${whereSql}
       ${orderSql}
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { ...params, offset, limit: pageSize }
    );

    return NextResponse.json({ items: logs.recordset || [], total, hasIsHidden });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'admin-logs-purge', 5, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const username = session.user.id;
    const ip = (request.headers.get('x-forwarded-for') || '')
      .split(',')[0]
      .trim() || request.headers.get('x-real-ip') || '127.0.0.1';

    // Only Super Admins (>=4) can manage logs
    const adminCheck = await userDB.query(
      `SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username`,
      { username }
    );
    if (!adminCheck.recordset?.length) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const user = adminCheck.recordset[0];
    const isSuperAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 4;
    if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').toLowerCase();

    if (action === 'delete') {
      const ids: number[] = Array.isArray(body.ids) ? body.ids.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n)) : [];
      if (!ids.length) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
      const paramMap: Record<string, any> = {};
      const inList = ids.map((id, i) => { const key = `id${i}`; paramMap[key] = id; return `@${key}`; }).join(',');
      await webDB.query(`DELETE FROM WebAuditLogs WHERE LogID IN (${inList})`, paramMap);
      await webDB.query(
        `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
         VALUES (@actor, 'ADMIN_LOGS_MANAGE', @details, @ip)`,
        { actor: username, details: `delete ids=[${ids.join(',')}]`, ip }
      );
      return NextResponse.json({ ok: true, deleted: ids.length });
    }

    if (action === 'purge') {
      const days = Number(body.days || 0);
      if (Number.isFinite(days) && days > 0) {
        await webDB.query(`DELETE FROM WebAuditLogs WHERE DATEDIFF(DAY, Timestamp, GETDATE()) >= @days`, { days });
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
           VALUES (@actor, 'ADMIN_LOGS_MANAGE', @details, @ip)`,
          { actor: username, details: `purge older_than_days=${days}` , ip }
        );
        return NextResponse.json({ ok: true, purged: 'older_than_days', days });
      } else {
        await webDB.query(`DELETE FROM WebAuditLogs`);
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
           VALUES (@actor, 'ADMIN_LOGS_MANAGE', @details, @ip)`,
          { actor: username, details: `purge all` , ip }
        );
        return NextResponse.json({ ok: true, purged: 'all' });
      }
    }

    if (action === 'hide' || action === 'unhide') {
      // Check IsHidden support
      const hiddenColCheck = await webDB.query(
        `SELECT 1 AS HasColumn FROM sys.columns WHERE Name = N'IsHidden' AND Object_ID = Object_ID(N'WebAuditLogs')`
      );
      const hasIsHidden = !!hiddenColCheck.recordset?.length;
      if (!hasIsHidden) return NextResponse.json({ error: 'IsHidden column not available' }, { status: 400 });

      const ids: number[] = Array.isArray(body.ids) ? body.ids.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n)) : [];
      if (!ids.length) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
      const flag = action === 'hide' ? 1 : 0;
      const paramMap: Record<string, any> = { flag };
      const inList = ids.map((id, i) => { const key = `id${i}`; paramMap[key] = id; return `@${key}`; }).join(',');
      await webDB.query(`UPDATE WebAuditLogs SET IsHidden = @flag WHERE LogID IN (${inList})`, paramMap);
      await webDB.query(
        `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
         VALUES (@actor, 'ADMIN_LOGS_MANAGE', @details, @ip)`,
        { actor: username, details: `${action} ids=[${ids.join(',')}]`, ip }
      );
      return NextResponse.json({ ok: true, updated: ids.length, isHidden: !!flag });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing logs:', error);
    return NextResponse.json({ error: 'Failed to manage logs' }, { status: 500 });
  }
}
