import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB, webDB } from '@/lib/db';

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

    const res = await webDB.query(`SELECT TOP 1 Content FROM WebPages WHERE Slug = @slug`, { slug: 'downloads-links' });
    const row = res.recordset?.[0];
    let links: Array<{ label: string; url: string }> = [];
    if (row?.Content) {
      try { const parsed = JSON.parse(String(row.Content)); links = Array.isArray(parsed.links) ? parsed.links : []; } catch {}
    }
    return NextResponse.json({ links });
  } catch (e) {
    console.error('GET downloads-links error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
    const isSuperAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 4;
    if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const links = Array.isArray(body.links) ? body.links : [];

    await webDB.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'WebPages')
      BEGIN
        CREATE TABLE WebPages (
          Slug nvarchar(100) NOT NULL PRIMARY KEY,
          Title nvarchar(200) NOT NULL,
          Content nvarchar(max) NULL,
          UpdatedAt datetime NOT NULL CONSTRAINT DF_WebPages_UpdatedAt DEFAULT(GETDATE()),
          UpdatedBy nvarchar(50) NULL
        )
      END
    `);

    const exists = await webDB.query(`SELECT 1 AS X FROM WebPages WHERE Slug = @slug`, { slug: 'downloads-links' });
    const payload = JSON.stringify({ links });
    if (exists.recordset?.length) {
      await webDB.query(`UPDATE WebPages SET Title = @title, Content = @content, UpdatedAt = GETDATE(), UpdatedBy = @by WHERE Slug = @slug`, {
        slug: 'downloads-links', title: 'Downloads Links', content: payload, by: username,
      });
    } else {
      await webDB.query(`INSERT INTO WebPages (Slug, Title, Content, UpdatedAt, UpdatedBy) VALUES (@slug, @title, @content, GETDATE(), @by)`, {
        slug: 'downloads-links', title: 'Downloads Links', content: payload, by: username,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST downloads-links error:', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
