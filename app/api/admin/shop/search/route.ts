import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { gameDB, webDB } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.name) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const priv = await checkAdminPrivileges(session.user.name);
    if (!priv.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get('pageSize') || '50', 10)));
    const pathFilter = searchParams.get('pathFilter') || '';
    const offset = (page - 1) * pageSize;

    // Only allow valid path values
    const allowedPaths = ['Event', 'Premium', 'Potion'];
    const pathClause = allowedPaths.includes(pathFilter)
      ? `szItemPath = '${pathFilter}'`
      : `szItemPath IN ('Event', 'Premium', 'Potion')`;

    let query = `
      SELECT sItemID, szItemName, szLastCategory, szItemPath, iLevel
      FROM ItemList
      WHERE ${pathClause}
    `;
    const params: Record<string, any> = {};

    if (search) {
      query += ` AND szItemName LIKE @search`;
      params.search = `%${search}%`;
    }

    const countQuery = query.replace(
      'SELECT sItemID, szItemName, szLastCategory, szItemPath, iLevel',
      'SELECT COUNT(*) as total'
    );
    const countResult = await gameDB.query(countQuery, params);
    const total = countResult.recordset[0].total;

    query += ` ORDER BY szItemPath, szItemName OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`;
    const result = await gameDB.query(query, { ...params, offset, pageSize });

    // Check which items are already in the shop
    const sItemIDs = result.recordset.map((r: any) => r.sItemID);
    let inShopSet = new Set<string>();
    if (sItemIDs.length > 0) {
      const inList = sItemIDs.map((_, i) => `@id${i}`).join(',');
      const shopParams: Record<string, any> = {};
      sItemIDs.forEach((id: number, i: number) => { shopParams[`id${i}`] = id; });
      const shopResult = await webDB.query(`
        SELECT sItemID FROM WebShopItems WHERE sItemID IN (${inList})
      `, shopParams);
      inShopSet = new Set(shopResult.recordset.map((r: any) => String(r.sItemID)));
    }

    const items = result.recordset.map((r: any) => ({
      ...r,
      imageUrl: `/items/it${(r.szLastCategory || '').toLowerCase()}.png`,
      inShop: inShopSet.has(String(r.sItemID)),
    }));

    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    console.error('[admin/shop/search]', error);
    return NextResponse.json({ error: 'Failed to search items' }, { status: 500 });
  }
}
