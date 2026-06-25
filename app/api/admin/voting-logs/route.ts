import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB, userDB } from '@/lib/db';
import { invalidate } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;

    const adminCheck = await userDB.query(
      `SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username`,
      { username }
    );
    if (!adminCheck.recordset?.length) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const user = adminCheck.recordset[0];
    if (!(user.GameMasterType === 1 && user.GameMasterLevel >= 4)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const sort = searchParams.get('sort') || 'newest';
    const q = (searchParams.get('q') || '').trim();
    const ip = (searchParams.get('ip') || '').trim();
    const account = (searchParams.get('account') || '').trim();
    const claimed = searchParams.get('claimed');

    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: Record<string, any> = {};

    if (q) {
      conditions.push('(AccountName LIKE @q OR IPAddress LIKE @q)');
      params.q = `${q}%`;
    }
    if (ip) {
      conditions.push('IPAddress LIKE @ip');
      params.ip = `${ip}%`;
    }
    if (account) {
      conditions.push('AccountName LIKE @account');
      params.account = `${account}%`;
    }
    if (claimed === '1') {
      conditions.push('RewardClaimed = 1');
    } else if (claimed === '0') {
      conditions.push('RewardClaimed = 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = sort === 'oldest' ? 'VoteTime ASC' : 'VoteTime DESC';

    const countResult = await webDB.query(
      `SELECT COUNT(*) as total FROM VoteLogs ${whereClause}`,
      params
    );
    const total = countResult.recordset[0]?.total || 0;

    const logsResult = await webDB.query(
      `SELECT LogID, AccountName, VoteTime, IPAddress, RewardClaimed
       FROM VoteLogs
       ${whereClause}
       ORDER BY ${orderBy}
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
      { ...params, offset, pageSize }
    );

    return NextResponse.json({
      items: logsResult.recordset,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Error fetching voting logs:', error);
    return NextResponse.json({ error: 'Failed to fetch voting logs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;
    const ip = (request.headers.get('x-forwarded-for') || '')
      .split(',')[0]
      .trim() || request.headers.get('x-real-ip') || '127.0.0.1';

    const adminCheck = await userDB.query(
      `SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username`,
      { username }
    );
    if (!adminCheck.recordset?.length) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const user = adminCheck.recordset[0];
    if (!(user.GameMasterType === 1 && user.GameMasterLevel >= 4)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').toLowerCase();

    if (action === 'delete') {
      const ids: number[] = Array.isArray(body.ids) ? body.ids.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n)) : [];
      if (!ids.length) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
      const paramMap: Record<string, any> = {};
      const inList = ids.map((id, i) => { const key = `id${i}`; paramMap[key] = id; return `@${key}`; }).join(',');
      await webDB.query(`DELETE FROM VoteLogs WHERE LogID IN (${inList})`, paramMap);
      await webDB.query(
        `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
         VALUES (@actor, 'ADMIN_VOTELOGS_MANAGE', @details, @ip)`,
        { actor: username, details: `delete ids=[${ids.join(',')}]`, ip }
      );
      return NextResponse.json({ ok: true, deleted: ids.length });
    }

    if (action === 'purge') {
      const days = Number(body.days || 0);
      if (Number.isFinite(days) && days > 0) {
        await webDB.query(`DELETE FROM VoteLogs WHERE DATEDIFF(DAY, VoteTime, GETDATE()) >= @days`, { days });
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
           VALUES (@actor, 'ADMIN_VOTELOGS_MANAGE', @details, @ip)`,
          { actor: username, details: `purge older_than_days=${days}`, ip }
        );
        return NextResponse.json({ ok: true, purged: 'older_than_days', days });
      } else {
        await webDB.query(`DELETE FROM VoteLogs`);
        await webDB.query(
          `INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
           VALUES (@actor, 'ADMIN_VOTELOGS_MANAGE', @details, @ip)`,
          { actor: username, details: `purge all`, ip }
        );
        return NextResponse.json({ ok: true, purged: 'all' });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing voting logs:', error);
    return NextResponse.json({ error: 'Failed to manage voting logs' }, { status: 500 });
  }
}
