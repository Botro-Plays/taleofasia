import { NextResponse } from 'next/server';
import { webDB } from '@/lib/db';
import { cached } from '@/lib/cache';

export async function GET() {
  try {
    const items = await cached('launcher-news:public', 60_000, async () => {
      const tableCheck = await webDB.query(
        `SELECT 1 AS HasTable FROM sys.tables WHERE name = N'LauncherNews'`
      );
      if (!tableCheck.recordset?.length) return [];

      const res = await webDB.query(`
        SELECT Id, Title, Body, Category, PublishedAt
        FROM LauncherNews
        WHERE IsPublished = 1
        ORDER BY SortOrder ASC, PublishedAt DESC
      `);

      return (res.recordset || []).map((row: any) => ({
        id: row.Id,
        title: row.Title,
        body: row.Body,
        category: row.Category,
        publishedAt: row.PublishedAt instanceof Date
          ? row.PublishedAt.toISOString()
          : String(row.PublishedAt),
      }));
    });

    return NextResponse.json(
      { items },
      { headers: { 'Cache-Control': 'public, max-age=60' } }
    );
  } catch (error) {
    console.error('Launcher news GET error:', error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
