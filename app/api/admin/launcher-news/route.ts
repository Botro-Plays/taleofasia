import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB, userDB } from '@/lib/db';
import { invalidate } from '@/lib/cache';

async function checkAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const result = await userDB.query(
    `SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username`,
    { username: session.user.id }
  );
  if (!result.recordset?.length) return null;
  const user = result.recordset[0];
  const isAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 3;
  const isSuperAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 4;
  if (!isAdmin) return null;
  return { username: session.user.id, isSuperAdmin };
}

export async function GET() {
  try {
    const admin = await checkAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tableCheck = await webDB.query(
      `SELECT 1 AS HasTable FROM sys.tables WHERE name = N'LauncherNews'`
    );
    if (!tableCheck.recordset?.length) {
      return NextResponse.json({ items: [], total: 0 });
    }

    const res = await webDB.query(`
      SELECT Id, Title, Body, Category, IsPublished, SortOrder, PublishedAt, UpdatedAt, UpdatedBy
      FROM LauncherNews
      ORDER BY SortOrder ASC, PublishedAt DESC
    `);

    const items = (res.recordset || []).map((row: any) => ({
      id: row.Id,
      title: row.Title,
      body: row.Body,
      category: row.Category,
      isPublished: !!row.IsPublished,
      sortOrder: row.SortOrder,
      publishedAt: row.PublishedAt instanceof Date
        ? row.PublishedAt.toISOString()
        : String(row.PublishedAt),
      updatedAt: row.UpdatedAt instanceof Date
        ? row.UpdatedAt.toISOString()
        : String(row.UpdatedAt),
      updatedBy: row.UpdatedBy,
    }));

    return NextResponse.json({ items, total: items.length });
  } catch (e) {
    console.error('Admin launcher-news GET error:', e);
    return NextResponse.json({ error: 'Failed to load news' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await checkAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!admin.isSuperAdmin)
      return NextResponse.json({ error: 'Forbidden — super admin only' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const id = body.id ? parseInt(body.id, 10) : 0;
    const title = String(body.title || '').trim();
    const content = String(body.body || '');
    const category = String(body.category || 'news').trim().toLowerCase();
    const isPublished = body.isPublished === true || body.isPublished === 1;
    const sortOrder = body.sortOrder ? parseInt(body.sortOrder, 10) : 0;

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const tableCheck = await webDB.query(
      `SELECT 1 AS HasTable FROM sys.tables WHERE name = N'LauncherNews'`
    );
    if (!tableCheck.recordset?.length) {
      await webDB.query(`
        CREATE TABLE [dbo].[LauncherNews] (
          [Id] INT IDENTITY(1,1) PRIMARY KEY,
          [Title] NVARCHAR(200) NOT NULL,
          [Body] NVARCHAR(MAX) NOT NULL,
          [Category] NVARCHAR(20) NOT NULL DEFAULT 'news',
          [IsPublished] BIT NOT NULL DEFAULT 1,
          [SortOrder] INT NOT NULL DEFAULT 0,
          [PublishedAt] DATETIME NOT NULL DEFAULT GETDATE(),
          [UpdatedAt] DATETIME NOT NULL DEFAULT GETDATE(),
          [UpdatedBy] NVARCHAR(50) NOT NULL
        )
      `);
    }

    if (id > 0) {
      await webDB.query(
        `UPDATE LauncherNews
         SET Title = @title, Body = @body, Category = @cat, IsPublished = @pub, SortOrder = @sort, UpdatedAt = GETDATE(), UpdatedBy = @by
         WHERE Id = @id`,
        { title, body: content, cat: category, pub: isPublished, sort: sortOrder, by: admin.username, id }
      );
    } else {
      await webDB.query(
        `INSERT INTO LauncherNews (Title, Body, Category, IsPublished, SortOrder, PublishedAt, UpdatedAt, UpdatedBy)
         VALUES (@title, @body, @cat, @pub, @sort, GETDATE(), GETDATE(), @by)`,
        { title, body: content, cat: category, pub: isPublished, sort: sortOrder, by: admin.username }
      );
    }

    try { invalidate('launcher-news:public'); } catch {}
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Admin launcher-news POST error:', e);
    return NextResponse.json({ error: 'Failed to save news' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await checkAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!admin.isSuperAdmin)
      return NextResponse.json({ error: 'Forbidden — super admin only' }, { status: 403 });

    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await webDB.query(`DELETE FROM LauncherNews WHERE Id = @id`, { id });

    try { invalidate('launcher-news:public'); } catch {}
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Admin launcher-news DELETE error:', e);
    return NextResponse.json({ error: 'Failed to delete news' }, { status: 500 });
  }
}
