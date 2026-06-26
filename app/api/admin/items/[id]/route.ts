import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB, gameDB } from '@/lib/db';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { buildCategorySQL } from '@/lib/item-types';

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAdmin } = await checkAdminPrivileges(session.user.name);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { sItemID, szItemName, isVisible } = body;

    if (!sItemID || !szItemName || typeof isVisible !== 'boolean') {
      return NextResponse.json(
        { error: 'sItemID, szItemName and isVisible are required' },
        { status: 400 }
      );
    }

    // Get item info from GameDB
    const itemResult = await gameDB.query(
      'SELECT szItemName, szItemPath, szLastCategory FROM ItemList WHERE sItemID = @id AND szItemName = @name',
      { id: sItemID, name: szItemName }
    );

    if (itemResult.recordset.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const item = itemResult.recordset[0];

    // Upsert visibility in WebDB (composite key: sItemID + szItemName)
    await webDB.query(`
      MERGE ItemVisibility AS target
      USING (SELECT @sItemID AS sItemID, @szItemName AS szItemName) AS source
      ON target.sItemID = source.sItemID AND target.szItemName = source.szItemName
      WHEN MATCHED THEN
        UPDATE SET IsVisible = @isVisible, UpdatedAt = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (sItemID, szItemName, szItemPath, szLastCategory, IsVisible)
        VALUES (@sItemID, @szItemName, @szItemPath, @szLastCategory, @isVisible);
    `, {
      sItemID,
      isVisible,
      szItemName: item.szItemName,
      szItemPath: item.szItemPath,
      szLastCategory: item.szLastCategory,
    });

    return NextResponse.json({ success: true, sItemID, szItemName, isVisible });
  } catch (error: any) {
    console.error('[API /admin/items/toggle] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update visibility' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  // Bulk update visibility for a category
  try {
    const session = await auth();
    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAdmin } = await checkAdminPrivileges(session.user.name);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { category, sub, isVisible } = body;

    if (!category || typeof isVisible !== 'boolean') {
      return NextResponse.json(
        { error: 'category and isVisible are required' },
        { status: 400 }
      );
    }

    // Get all items in this type-based category from GameDB
    const { clause, params: catParams } = buildCategorySQL(category, sub || undefined);
    const itemsResult = await gameDB.query(
      `SELECT sItemID, szItemName, szItemPath, szLastCategory FROM ItemList WHERE 1=1 ${clause}`,
      catParams
    );

    if (itemsResult.recordset.length === 0) {
      return NextResponse.json({ error: 'No items found in category' }, { status: 404 });
    }

    // Upsert all items' visibility (composite key: sItemID + szItemName)
    for (const item of itemsResult.recordset) {
      await webDB.query(`
        MERGE ItemVisibility AS target
        USING (SELECT @sItemID AS sItemID, @szItemName AS szItemName) AS source
        ON target.sItemID = source.sItemID AND target.szItemName = source.szItemName
        WHEN MATCHED THEN
          UPDATE SET IsVisible = @isVisible, UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (sItemID, szItemName, szItemPath, szLastCategory, IsVisible)
          VALUES (@sItemID, @szItemName, @szItemPath, @szLastCategory, @isVisible);
      `, {
        sItemID: item.sItemID,
        isVisible,
        szItemName: item.szItemName,
        szItemPath: item.szItemPath,
        szLastCategory: item.szLastCategory,
      });
    }

    return NextResponse.json({
      success: true,
      category,
      sub: sub || '',
      isVisible,
      count: itemsResult.recordset.length,
    });
  } catch (error: any) {
    console.error('[API /admin/items/bulk] Error:', error);
    return NextResponse.json(
      { error: 'Failed to bulk update visibility' },
      { status: 500 }
    );
  }
}
