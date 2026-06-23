import { NextResponse } from 'next/server';
import { webDB } from '@/lib/db';
import { cached } from '@/lib/cache';

export async function GET() {
  try {
    const data = await cached('public:pages:list', 60_000, async () => {
      const table = await webDB.query(`SELECT 1 AS HasTable FROM sys.tables WHERE name = N'WebPages'`);
      const has = !!table.recordset?.length;
      if (!has) return { items: [] as Array<{ Slug: string; Title: string; UpdatedAt: string | null }> };
      const res = await webDB.query<{ Slug: string; Title: string; UpdatedAt: Date }>(
        `SELECT TOP 50 Slug, Title, UpdatedAt FROM WebPages ORDER BY UpdatedAt DESC`
      );
      const items = (res.recordset || []).map((r) => ({ Slug: r.Slug, Title: r.Title, UpdatedAt: r.UpdatedAt ? new Date(r.UpdatedAt).toISOString() : null }));
      return { items };
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error('Public pages list error:', e);
    return NextResponse.json({ items: [] });
  }
}
