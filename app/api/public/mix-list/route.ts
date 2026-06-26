import { NextResponse } from 'next/server';
import { gameDB } from '@/lib/db';
import { cached } from '@/lib/cache';

export async function GET() {
  try {
    const data = await cached('public:mix-list', 60_000, async () => {
      const res = await gameDB.query<any>(
        `SELECT * FROM MixList WHERE TypeMix != 10 AND NewSheltom14 = 0 AND NewSheltom15 = 0 ORDER BY TypeMix ASC, ID ASC`
      );
      const items = res.recordset || [];
      return { items };
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error('Public mix-list error:', e);
    return NextResponse.json({ items: [] });
  }
}
