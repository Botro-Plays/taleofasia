import { NextResponse } from 'next/server';
import { webDB, gameDB } from '@/lib/db';
import { cached } from '@/lib/cache';

export async function GET() {
  try {
    const items = await cached('shop_items_public', 30_000, async () => {
      const shopResult = await webDB.query(`
        SELECT ShopItemID, sItemID, szItemName, szLastCategory, szItemPath, PriceVP, SortOrder
        FROM WebShopItems
        WHERE IsActive = 1
        ORDER BY SortOrder, szItemName
      `);

      if (shopResult.recordset.length === 0) return [];

      // Fetch item images from GameDB
      const sItemIDs = shopResult.recordset.map((r: any) => r.sItemID);
      const inList = sItemIDs.map((_, i) => `@id${i}`).join(',');
      const params: Record<string, any> = {};
      sItemIDs.forEach((id: number, i: number) => { params[`id${i}`] = id; });

      const gameResult = await gameDB.query(`
        SELECT sItemID, szLastCategory, iLevel, iWidth, iHeight
        FROM ItemList
        WHERE sItemID IN (${inList})
      `, params);

      const gameMap = new Map<string, any>();
      gameResult.recordset.forEach((r: any) => {
        gameMap.set(String(r.sItemID), r);
      });

      return shopResult.recordset.map((shop: any) => {
        const game = gameMap.get(String(shop.sItemID));
        const cat = (game?.szLastCategory || shop.szLastCategory || '').toLowerCase();
        return {
          shopItemId: shop.ShopItemID,
          sItemID: shop.sItemID,
          szItemName: shop.szItemName,
          szLastCategory: shop.szLastCategory,
          szItemPath: shop.szItemPath,
          priceVP: shop.PriceVP,
          sortOrder: shop.SortOrder,
          iLevel: game?.iLevel || 0,
          imageUrl: `/items/it${cat}.png`,
        };
      });
    });

    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch (error) {
    console.error('Error fetching shop items:', error);
    return NextResponse.json({ error: 'Failed to fetch shop items' }, { status: 500 });
  }
}
