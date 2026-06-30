import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.name) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const username = session.user.name;

    const result = await webDB.query(`
      SELECT TOP 20
        PurchaseID, szItemName, PriceVP, Delivered, PurchasedAt
      FROM WebShopPurchases
      WHERE AccountName = @username
      ORDER BY PurchasedAt DESC
    `, { username });

    return NextResponse.json(result.recordset, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 });
  }
}
