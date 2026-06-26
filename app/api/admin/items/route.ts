import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { gameDB, webDB } from '@/lib/db';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { buildCategorySQL, MAIN_CATEGORIES, getItemType } from '@/lib/item-types';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAdmin } = await checkAdminPrivileges(session.user.name);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || '';
    const sub = searchParams.get('sub') || '';
    const search = searchParams.get('search') || '';
    const visibleOnly = searchParams.get('visible') === '1';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    // Get visibility map from WebDB (composite key: sItemID + szItemName)
    const visResult = await webDB.query('SELECT sItemID, szItemName, IsVisible FROM ItemVisibility');
    const visMap = new Map<string, boolean>();
    visResult.recordset.forEach((r: any) => {
      visMap.set(`${r.sItemID}|${r.szItemName}`, !!r.IsVisible);
    });

    // Build query
    let query = `
      SELECT sItemID, szItemName, szLastCategory, szItemPath, iLevel, iClass, iWidth, iHeight
      FROM ItemList WHERE 1=1
    `;
    const params: Record<string, any> = {};

    if (category) {
      const { clause, params: catParams } = buildCategorySQL(category, sub || undefined);
      query += clause;
      Object.assign(params, catParams);
    }

    if (search) {
      query += ` AND szItemName LIKE @search`;
      params.search = `%${search}%`;
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT sItemID, szItemName, szLastCategory, szItemPath, iLevel, iClass, iWidth, iHeight',
      'SELECT COUNT(*) as total'
    );
    const countResult = await gameDB.query(countQuery, params);
    const total = countResult.recordset[0].total;

    // Add pagination
    const offset = (page - 1) * pageSize;
    query += ` ORDER BY szLastCategory, iLevel, szItemName OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;

    const result = await gameDB.query(query, params);

    let items = result.recordset.map((item: any) => {
      const typeInfo = getItemType(item.szLastCategory);
      return {
        ...item,
        mainCategory: typeInfo?.main || 'other',
        subCategory: typeInfo?.sub || 'Other',
        isVisible: visMap.has(`${item.sItemID}|${item.szItemName}`) ? visMap.get(`${item.sItemID}|${item.szItemName}`) : false,
        imageUrl: `/items/it${item.szLastCategory.toLowerCase()}.png`,
      };
    });

    if (visibleOnly) {
      items = items.filter((i: any) => i.isVisible);
    }

    // Build sub-category counts for the active main category
    let subCategories: Array<{ key: string; label: string; count: number }> = [];
    if (category) {
      const mainCat = MAIN_CATEGORIES.find(c => c.key === category);
      if (mainCat) {
        const countPromises = mainCat.subs.map(async (s) => {
          const { clause, params: cp } = buildCategorySQL(category, s.key);
          const countQ = `SELECT COUNT(*) as cnt FROM ItemList WHERE 1=1 ${clause}`;
          const r = await gameDB.query(countQ, cp);
          return { key: s.key, label: s.label, count: r.recordset[0].cnt };
        });
        subCategories = await Promise.all(countPromises);
      }
    }

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      mainCategories: MAIN_CATEGORIES.map(c => ({
        key: c.key,
        label: c.label,
        subs: c.subs.map(s => ({ key: s.key, label: s.label })),
      })),
      subCategories,
    });
  } catch (error: any) {
    console.error('[API /admin/items] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}
