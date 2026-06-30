import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { webDB } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.name) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const priv = await checkAdminPrivileges(session.user.name);
    if (!priv.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get('pageSize') || '50', 10)));
    const filter = searchParams.get('filter') || 'all'; // 'all' | 'undelivered'
    const offset = (page - 1) * pageSize;

    // Summary stats
    const summaryResult = await webDB.query(`
      SELECT
        COUNT(*) AS totalPurchases,
        ISNULL(SUM(PriceVP), 0) AS totalVPSpent,
        ISNULL(SUM(CASE WHEN Delivered = 0 THEN 1 ELSE 0 END), 0) AS undelivered
      FROM WebShopPurchases
    `);
    const summary = summaryResult.recordset[0] || { totalPurchases: 0, totalVPSpent: 0, undelivered: 0 };

    // VP holders stats
    const vpResult = await webDB.query(`
      SELECT
        COUNT(*) AS holders,
        ISNULL(SUM(VotePoints), 0) AS totalVP,
        ISNULL(SUM(TotalEarned), 0) AS totalEarned,
        ISNULL(SUM(TotalSpent), 0) AS totalSpent
      FROM WebVotePoints
    `);
    const vpStats = vpResult.recordset[0] || { holders: 0, totalVP: 0, totalEarned: 0, totalSpent: 0 };

    // Top 10 buyers
    const topBuyersResult = await webDB.query(`
      SELECT TOP 10 AccountName,
        COUNT(*) AS purchases,
        SUM(PriceVP) AS totalSpent
      FROM WebShopPurchases
      GROUP BY AccountName
      ORDER BY totalSpent DESC
    `);

    // Purchases (paginated)
    let whereClause = '';
    if (filter === 'undelivered') whereClause = 'WHERE Delivered = 0';

    const countResult = await webDB.query(`SELECT COUNT(*) AS total FROM WebShopPurchases ${whereClause}`);
    const total = countResult.recordset[0].total;

    const purchasesResult = await webDB.query(`
      SELECT p.PurchaseID, p.AccountName, p.szItemName,
             ISNULL(si.szItemPath, '') AS szItemPath,
             p.PriceVP, p.PurchasedAt, p.Delivered, p.DeliveredAt
      FROM WebShopPurchases p
      LEFT JOIN WebShopItems si ON p.ShopItemID = si.ShopItemID
      ${whereClause.replace('WHERE Delivered', 'WHERE p.Delivered')}
      ORDER BY p.PurchasedAt DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `, {
      offset,
      pageSize,
    });

    return NextResponse.json({
      summary,
      vpStats,
      topBuyers: topBuyersResult.recordset,
      purchases: purchasesResult.recordset,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[admin/shop/stats]', error);
    return NextResponse.json({ error: 'Failed to fetch shop stats' }, { status: 500 });
  }
}
