import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB, webDB } from '@/lib/db';
import { rateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

const SLUG = 'admin-game-logs';

function normalizeUser(u?: string | null) {
  return String(u || '').trim().toLowerCase();
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const username = session.user.id;
    const adminCheck = await userDB.query(
      `SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username`,
      { username }
    );
    if (!adminCheck.recordset?.length) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const user = adminCheck.recordset[0];
    const isAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 3;
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Ensure table exists
    await webDB.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'AdminLayouts')
      BEGIN
        CREATE TABLE AdminLayouts (
          Slug nvarchar(100) NOT NULL PRIMARY KEY,
          OwnerAccount nvarchar(50) NOT NULL,
          LayoutJson nvarchar(max) NOT NULL,
          UpdatedAt datetime NOT NULL CONSTRAINT DF_AdminLayouts_UpdatedAt DEFAULT(GETDATE()),
          UpdatedBy nvarchar(50) NULL
        )
      END
    `);

    const res = await webDB.query(
      `SELECT Slug, OwnerAccount, LayoutJson, UpdatedAt, UpdatedBy FROM AdminLayouts WHERE Slug = @slug`,
      { slug: SLUG }
    );
    let layout: any = null;
    if (res.recordset?.length) {
      const row = res.recordset[0];
      try { layout = JSON.parse(String(row.LayoutJson || 'null')); } catch { layout = null; }
    }
    if (!layout) {
      layout = { version: 1, owner: 'botro', tables: {} };
    }
    // Always present owner as 'botro' on read
    layout.owner = 'botro';

    const canEdit = normalizeUser(username) === 'botro';

    return NextResponse.json({ layout, canEdit });
  } catch (e) {
    console.error('GET admin-game-logs layout error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ip = getClientIP(request);
  const limit = rateLimiter.check(ip, 'admin-game-logs-layout', 10, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const username = session.user.id;
    const adminCheck = await userDB.query(
      `SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username`,
      { username }
    );
    if (!adminCheck.recordset?.length) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const user = adminCheck.recordset[0];
    const isAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 3;
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const incoming = body?.layout;
    if (!incoming || typeof incoming !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Enforce only 'botro' (case-insensitive) can save; ignore incoming owner
    const owner = 'botro';
    if (normalizeUser(username) !== owner) {
      return NextResponse.json({ error: 'Only owner can save' }, { status: 403 });
    }

    // Basic shape validation
    const tables = incoming.tables;
    if (!tables || typeof tables !== 'object') {
      return NextResponse.json({ error: 'Invalid tables' }, { status: 400 });
    }
    // Optional hiddenTables pass-through
    let hiddenTables: string[] | undefined;
    if (Array.isArray(incoming.hiddenTables)) {
      hiddenTables = (incoming.hiddenTables as any[])
        .map((x) => String(x || '').trim())
        .filter((x) => x.length > 0);
    }

    // Ensure table exists
    await webDB.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'AdminLayouts')
      BEGIN
        CREATE TABLE AdminLayouts (
          Slug nvarchar(100) NOT NULL PRIMARY KEY,
          OwnerAccount nvarchar(50) NOT NULL,
          LayoutJson nvarchar(max) NOT NULL,
          UpdatedAt datetime NOT NULL CONSTRAINT DF_AdminLayouts_UpdatedAt DEFAULT(GETDATE()),
          UpdatedBy nvarchar(50) NULL
        )
      END
    `);

    const payload = JSON.stringify({ version: Number(incoming.version) || 1, owner: owner, tables, hiddenTables });

    const exists = await webDB.query(`SELECT 1 AS X FROM AdminLayouts WHERE Slug = @slug`, { slug: SLUG });
    if (exists.recordset?.length) {
      await webDB.query(
        `UPDATE AdminLayouts SET OwnerAccount = @owner, LayoutJson = @json, UpdatedAt = GETDATE(), UpdatedBy = @by WHERE Slug = @slug`,
        { slug: SLUG, owner: owner, json: payload, by: username }
      );
    } else {
      await webDB.query(
        `INSERT INTO AdminLayouts (Slug, OwnerAccount, LayoutJson, UpdatedAt, UpdatedBy) VALUES (@slug, @owner, @json, GETDATE(), @by)`,
        { slug: SLUG, owner: owner, json: payload, by: username }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST admin-game-logs layout error:', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
