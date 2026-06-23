import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB, userDB } from '@/lib/db';
import { invalidate } from '@/lib/cache';

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const slug = (url.searchParams.get('slug') || '').toLowerCase();

    const tableCheck = await webDB.query(`SELECT 1 AS HasTable FROM sys.tables WHERE name = N'WebPages'`);
    const hasTable = !!tableCheck.recordset?.length;

    if (!hasTable) {
      return NextResponse.json({ error: 'WebPages table not found. Please create it first.' }, { status: 400 });
    }

    if (slug) {
      const res = await webDB.query(
        `SELECT TOP 1 Slug, Title, Content, UpdatedAt, UpdatedBy FROM WebPages WHERE Slug = @slug`,
        { slug }
      );
      const row = res.recordset?.[0] || null;
      return NextResponse.json({ item: row, total: row ? 1 : 0 });
    }

    const res = await webDB.query(`SELECT Slug, Title, UpdatedAt, UpdatedBy FROM WebPages ORDER BY UpdatedAt DESC`);
    return NextResponse.json({ items: res.recordset || [], total: (res.recordset || []).length });
  } catch (e) {
    console.error('Admin pages GET error:', e);
    return NextResponse.json({ error: 'Failed to load pages' }, { status: 500 });
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
    const slug = String(body.slug || '').toLowerCase();
    const title = String(body.title || '').trim();
    const content = String(body.content || '');
    if (!slug || !title) return NextResponse.json({ error: 'Missing slug or title' }, { status: 400 });

    const tableCheck = await webDB.query(`SELECT 1 AS HasTable FROM sys.tables WHERE name = N'WebPages'`);
    const hasTable = !!tableCheck.recordset?.length;
    if (!hasTable) return NextResponse.json({ error: 'WebPages table not found. Please create it first.' }, { status: 400 });

    const exists = await webDB.query(`SELECT 1 AS X FROM WebPages WHERE Slug = @slug`, { slug });
    if (exists.recordset?.length) {
      await webDB.query(
        `UPDATE WebPages SET Title = @title, Content = @content, UpdatedAt = GETDATE(), UpdatedBy = @by WHERE Slug = @slug`,
        { slug, title, content, by: username }
      );
    } else {
      await webDB.query(
        `INSERT INTO WebPages (Slug, Title, Content, UpdatedAt, UpdatedBy) VALUES (@slug, @title, @content, GETDATE(), @by)`,
        { slug, title, content, by: username }
      );
    }

    // Invalidate public pages caches so nav and sitemap reflect changes quickly
    try { invalidate('public:pages:list'); } catch {}
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Admin pages POST error:', e);
    return NextResponse.json({ error: 'Failed to save page' }, { status: 500 });
  }
}
