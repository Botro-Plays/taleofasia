import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { checkAdminPrivileges } from '@/lib/auth/admin';
import { webDB } from '@/lib/db';
import { invalidate } from '@/lib/cache';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.name) return null;
  const priv = await checkAdminPrivileges(session.user.name);
  if (!priv.isAdmin) return null;
  return session.user.name;
}

// GET — list all shop items (admin view, includes inactive)
export async function GET() {
  try {
    const adminUser = await requireAdmin();
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const shopResult = await webDB.query(`
      SELECT ShopItemID, sItemID, szItemName, szLastCategory, szItemPath, PriceVP, IsActive, SortOrder, CreatedAt
      FROM WebShopItems
      ORDER BY IsActive DESC, SortOrder, szItemName
    `);

    return NextResponse.json({ items: shopResult.recordset });
  } catch (error) {
    console.error('[admin/shop GET]', error);
    return NextResponse.json({ error: 'Failed to fetch shop items' }, { status: 500 });
  }
}

// POST — add item to shop
export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin();
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { sItemID, szItemName, szLastCategory, szItemPath, priceVP } = body;

    if (!sItemID || !szItemName || !szLastCategory) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const price = parseInt(priceVP, 10);
    if (!Number.isFinite(price) || price < 1) {
      return NextResponse.json({ error: 'Price must be a positive number' }, { status: 400 });
    }

    try {
      await webDB.query(`
        INSERT INTO WebShopItems (sItemID, szItemName, szLastCategory, szItemPath, PriceVP, IsActive, SortOrder)
        VALUES (@sItemID, @szItemName, @szLastCategory, @szItemPath, @priceVP, 1, 0)
      `, {
        sItemID,
        szItemName,
        szLastCategory,
        szItemPath: szItemPath || 'Event',
        priceVP: price,
      });
    } catch (err: any) {
      if (err?.number === 2627 || err?.code === 'EREQUEST') {
        return NextResponse.json({ error: 'This item is already in the shop' }, { status: 409 });
      }
      throw err;
    }

    invalidate('shop_items_public');
    return NextResponse.json({ message: 'Item added to shop' });
  } catch (error) {
    console.error('[admin/shop POST]', error);
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
  }
}

// PATCH — update price or active status
export async function PATCH(request: NextRequest) {
  try {
    const adminUser = await requireAdmin();
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { shopItemId, priceVP, isActive, sortOrder } = body;

    if (!shopItemId) {
      return NextResponse.json({ error: 'Missing shopItemId' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: Record<string, any> = { shopItemId };

    if (priceVP !== undefined) {
      const price = parseInt(priceVP, 10);
      if (!Number.isFinite(price) || price < 1) {
        return NextResponse.json({ error: 'Price must be a positive number' }, { status: 400 });
      }
      updates.push('PriceVP = @priceVP');
      params.priceVP = price;
    }

    if (isActive !== undefined) {
      updates.push('IsActive = @isActive');
      params.isActive = isActive ? 1 : 0;
    }

    if (sortOrder !== undefined) {
      updates.push('SortOrder = @sortOrder');
      params.sortOrder = parseInt(sortOrder, 10) || 0;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await webDB.query(`
      UPDATE WebShopItems SET ${updates.join(', ')}
      WHERE ShopItemID = @shopItemId
    `, params);

    invalidate('shop_items_public');
    return NextResponse.json({ message: 'Shop item updated' });
  } catch (error) {
    console.error('[admin/shop PATCH]', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

// DELETE — remove item from shop
export async function DELETE(request: NextRequest) {
  try {
    const adminUser = await requireAdmin();
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const shopItemId = Number(searchParams.get('shopItemId'));

    if (!Number.isFinite(shopItemId)) {
      return NextResponse.json({ error: 'Missing or invalid shopItemId' }, { status: 400 });
    }

    await webDB.query(`
      DELETE FROM WebShopItems WHERE ShopItemID = @shopItemId
    `, { shopItemId });

    invalidate('shop_items_public');
    return NextResponse.json({ message: 'Item removed from shop' });
  } catch (error) {
    console.error('[admin/shop DELETE]', error);
    return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 });
  }
}
